use anchor_lang::prelude::*;
use crate::instructions::location;
use crate::state::Location;
use crate::state::OwnershipRef;
use crate::state::processor::*;
use crate::state::resource::*;
use crate::state::storage::*;
use crate::errors::ValidationError;

pub fn init(ctx: Context<InitProcessor>, processor_type: ProcessorType, resource_id: Pubkey, output_rate: i64, processing_duration: i64) -> Result<()> {
    let processor: &mut Account<Processor> = &mut ctx.accounts.processor;
    let location: &mut Account<Location> = &mut ctx.accounts.location;
    let owner: &Signer = &ctx.accounts.owner;
    let clock = Clock::get()?;

    processor.owner = *owner.key;
    processor.resource_id = resource_id;
    processor.location_id = location.key();
    processor.output_rate = output_rate;
    processor.processing_duration = processing_duration;
    processor.awaiting_units = 0;
    processor.claimed_at = clock.unix_timestamp;
    processor.processor_type = processor_type;

    require!(processor.output_rate > 0, ValidationError::InvalidInput);
    require!(processor.processing_duration > 0, ValidationError::InvalidInput);

    location.add(owner, OwnershipRef { item: processor.key(), player: owner.key() })
}

// claim any units "done" waiting
fn move_awaiting(processor: &mut Account<Processor>, storage: &mut Account<Storage>, current_timestamp: i64) -> Result<()> {
    require!(processor.processor_type == ProcessorType::Producer, ValidationError::InvalidProcessorType);
    require!(processor.location_id == storage.location_id, ValidationError::DifferentLocations);

    let withdraw_awaiting = match processor.processing_duration == 0 {
        true => processor.awaiting_units,
        false => {
            let previous_claim_at = processor.claimed_at;
            let diff_time = current_timestamp - previous_claim_at;
            let prod_slots_during_diff_time = diff_time / processor.processing_duration;
            let prod_during_diff_time = prod_slots_during_diff_time * processor.output_rate;
            let withdraw_awaiting = match processor.awaiting_units >= prod_during_diff_time {
                true => prod_during_diff_time,
                false => processor.awaiting_units,
            };
            withdraw_awaiting
        }
    };

    let available_capacity = storage.capacity - storage.amount;
    let withdraw_awaiting_within_capacity = match available_capacity > withdraw_awaiting {
        true => withdraw_awaiting,
        false => available_capacity,
    };

    storage.add(withdraw_awaiting_within_capacity, processor.location_id)?;
    processor.awaiting_units -= withdraw_awaiting_within_capacity;

    Ok(())
}

pub fn claim_production(ctx: Context<ProcessesResource>) -> Result<()> {
    let producer = &mut ctx.accounts.processor;
    let resource = &ctx.accounts.resource;
    let storage: &mut Account<Storage> = &mut ctx.accounts.storage;

    // Verify owner gets the resources, currently fun for anyone reading the source code
    // let owner: &Signer = &ctx.accounts.owner;

    msg!("claim_production/");

    let current_timestamp = Clock::get()?.unix_timestamp;
    producer.awaiting_units = calc_awaiting("claim_prod", current_timestamp, producer);

    if producer.awaiting_units > 0 {
        move_awaiting(producer, storage, current_timestamp)?;
    }

    producer.claimed_at = current_timestamp;

    msg!("/claim_production");

    require!(resource.input.is_empty(), ValidationError::ResourceInputMax);

    Ok(())
}

fn calc_awaiting(label: &str, current_timestamp: i64, processor: &Account<Processor>) -> i64 {
    let diff_time = current_timestamp - processor.claimed_at;
    let prod_slots_during_diff_time = diff_time / processor.processing_duration;
    let prod_during_diff_time = prod_slots_during_diff_time * processor.output_rate;
    msg!("{} [{} / {}] slots: {}, prod: {}", label, current_timestamp, diff_time, prod_slots_during_diff_time, prod_during_diff_time);
    prod_during_diff_time
}

fn validate_by_type(processor: &Account<Processor>, storage: &Account<Storage>, storage_input: &Account<Storage>, current_timestamp: i64) -> Result<()> {
    match processor.processor_type { 
        ProcessorType::Producer => {
            require!(location::same_location_id(storage.location_id(current_timestamp), storage_input.location_id(current_timestamp)), ValidationError::DifferentLocations);
        },
        ProcessorType::Sender => {
            // Sender should have enough to pay the sending cost, i.e. enough energy in a local storage to send.
        },
    }    
    Ok(())
}

pub fn produce_with_one_input(ctx: Context<ProcessesResourceWith1Input>) -> Result<()> {
    let processor = &mut ctx.accounts.processor;
    let resource_to_produce: &mut Account<Resource> = &mut ctx.accounts.resource_to_produce;
    let storage: &mut Account<Storage> = &mut ctx.accounts.storage;
    let storage_in: &mut Account<Storage> = &mut ctx.accounts.storage_input;
    let current_timestamp = Clock::get()?.unix_timestamp;

    msg!("produce_with_one_input/");
    
    require!(resource_to_produce.key().eq(&storage.resource_id), ValidationError::InputStorageNotSupplied);

    validate_by_type(&processor, storage, storage_in, current_timestamp)?;

    let input_exists: Option<usize> = match processor.processor_type { 
        ProcessorType::Producer => resource_to_produce.input.iter()
            .position(|input| input.key().eq(&storage_in.resource_id)),

        ProcessorType::Sender => {
            require!(false, ValidationError::FuelNotSupplied);
            None
        },
    };

    require!(input_exists.is_some(), ValidationError::InputStorageNotSupplied);

    let index = input_exists.unwrap();
    let required_input_amount = resource_to_produce.input_amount[index];
    require!(storage_in.amount >= required_input_amount, ValidationError::InputStorageAmountTooLow);

    storage_in.amount -= required_input_amount;
    processor.awaiting_units += calc_awaiting("prod_1", current_timestamp, &processor);

    if processor.awaiting_units > 0 {
        move_awaiting(processor, storage, current_timestamp)?;
    }

    processor.claimed_at = current_timestamp;

    msg!("/produce_with_one_input");

    Ok(())
}

pub fn produce_with_two_inputs(ctx: Context<ProcessesResourceWith2Inputs>) -> Result<()> {
    let processor = &mut ctx.accounts.processor;
    let resource_to_produce: &mut Account<Resource> = &mut ctx.accounts.resource_to_produce;
    let storage: &mut Account<Storage> = &mut ctx.accounts.storage;
    let storage_in_1: &mut Account<Storage> = &mut ctx.accounts.storage_input_1;
    let storage_in_2: &mut Account<Storage> = &mut ctx.accounts.storage_input_2;
    let current_timestamp = Clock::get()?.unix_timestamp; 

    let input_pos_1 = resource_to_produce.input.iter().position(|input| input.key().eq(&storage_in_1.resource_id));
    require!(input_pos_1.is_some(), ValidationError::InputStorage1NotSupplied);
    let input_pos_2 = resource_to_produce.input.iter().position(|input| input.key().eq(&storage_in_2.resource_id));
    require!(input_pos_2.is_some(), ValidationError::InputStorage2NotSupplied);

    validate_by_type(&processor, storage, storage_in_1, current_timestamp)?;
    validate_by_type(&processor, storage, storage_in_2, current_timestamp)?;

    let index_1 = input_pos_1.unwrap();
    let input_1_amount = resource_to_produce.input_amount[index_1];
    require!(storage_in_1.amount >= input_1_amount, ValidationError::InputStorageAmountTooLow);

    let index_2 = input_pos_2.unwrap();
    let input_2_amount = resource_to_produce.input_amount[index_2];
    require!(storage_in_2.amount >= input_2_amount, ValidationError::InputStorageAmountTooLow);

    storage_in_1.amount -= input_1_amount;
    storage_in_2.amount -= input_2_amount;
    processor.awaiting_units += processor.output_rate;

    if processor.awaiting_units > 0 {
        move_awaiting(processor, storage, current_timestamp)?;
    }

    processor.claimed_at = current_timestamp;

    Ok(())
}

#[derive(Accounts)]
pub struct InitProcessor<'info> {
    #[account(init, payer = owner, space = Processor::LEN)]
    pub processor: Account<'info, Processor>,
    #[account(mut)]
    pub location: Account<'info, Location>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ProcessesResource<'info> {
    #[account(mut)]
    pub processor: Account<'info, Processor>,
    #[account(mut)]
    pub resource: Account<'info, Resource>,
    #[account(mut)]
    pub storage: Account<'info, Storage>,
}

#[derive(Accounts)]
pub struct ProcessesResourceWith1Input<'info> {
    #[account(mut)]
    pub processor: Account<'info, Processor>,
    #[account(mut)]
    pub resource_to_produce: Account<'info, Resource>,
    #[account(mut)]
    pub storage: Account<'info, Storage>,
    #[account(mut)]
    pub storage_input: Account<'info, Storage>,
}

#[derive(Accounts)]
pub struct ProcessesResourceWith2Inputs<'info> {
    #[account(mut)]
    pub processor: Account<'info, Processor>,
    #[account(mut)]
    pub resource_to_produce: Account<'info, Resource>,
    #[account(mut)]
    pub storage: Account<'info, Storage>,
    #[account(mut)]
    pub storage_input_1: Account<'info, Storage>,
    #[account(mut)]
    pub storage_input_2: Account<'info, Storage>,
}
