use anchor_lang::prelude::*;
use crate::instructions::location;
use crate::state::Location;
use crate::state::OwnershipRef;
use crate::state::processor::*;
use crate::state::resource::*;
use crate::state::storage::*;
use crate::errors::ValidationError;

pub fn init(ctx: Context<InitProcessor>, processor_type: ProcessorType, fuel_resource_id: Pubkey, output_resource_id: Pubkey, output_rate: i64, processing_duration: i64, fuel_cost_type: FuelCostType, current_timestamp: i64) -> Result<()> {
    let processor: &mut Account<Processor> = &mut ctx.accounts.processor;
    let location: &mut Account<Location> = &mut ctx.accounts.location;
    let owner: &Signer = &ctx.accounts.owner;

    processor.owner = *owner.key;
    processor.location_id = location.key();
    processor.fuel_resource_id = fuel_resource_id;
    processor.output_resource_id = output_resource_id;
    processor.output_rate = output_rate;
    processor.processing_duration = processing_duration;
    processor.awaiting_units = 0;
    processor.claimed_at = current_timestamp;
    processor.processor_type = processor_type;
    processor.fuel_cost_type = fuel_cost_type;

    require!(processor.output_rate > 0, ValidationError::InvalidInput);
    require!(processor.processing_duration > 0, ValidationError::InvalidInput);

    location.add(owner, OwnershipRef { item: processor.key(), player: owner.key() })
}

// claim any units "done" waiting
fn move_awaiting(processor: &mut Account<Processor>, storage_out: &mut Account<Storage>, current_timestamp: i64, limit: Option<i64>) -> Result<()> {
    require!(processor.processing_duration > 0, ValidationError::ExperimentalError);
    
    let previous_claim_at = processor.claimed_at;
    let diff_time = current_timestamp - previous_claim_at;
    let prod_slots_during_diff_time = diff_time / processor.processing_duration;
    let prod_during_diff_time = prod_slots_during_diff_time * processor.output_rate;

    require!(previous_claim_at >= 0, ValidationError::ExperimentalError);
    require!(diff_time >= 0, ValidationError::ExperimentalError);
    require!(prod_slots_during_diff_time >= 0, ValidationError::ExperimentalError);
    require!(prod_during_diff_time >= 0, ValidationError::ExperimentalError);

    let limited_prod = match limit {
        Some(l) if prod_during_diff_time > l => l,
        _ => prod_during_diff_time,
    };

    require!(processor.awaiting_units >= 0, ValidationError::ExperimentalError);
    require!(limited_prod >= 0, ValidationError::ExperimentalError);

    let withdraw_awaiting = match processor.awaiting_units >= limited_prod {
        true => limited_prod,
        false => processor.awaiting_units,
    };

    let available_capacity = match storage_out.capacity - storage_out.amount {
        diff if diff > 0 => diff,
        _ => 0,
    };

    require!(available_capacity >= 0, ValidationError::ExperimentalError);
    require!(withdraw_awaiting >= 0, ValidationError::ExperimentalError);

    let withdraw_awaiting_within_capacity = match available_capacity > withdraw_awaiting {
        true => withdraw_awaiting,
        false => available_capacity,
    };

    match processor.processor_type {
        ProcessorType::Producer => storage_out.add(withdraw_awaiting_within_capacity, processor.location_id)?,
        ProcessorType::Sender => storage_out.add_impl(withdraw_awaiting_within_capacity, processor.location_id, false)?,
    };

    processor.awaiting_units -= withdraw_awaiting_within_capacity;
    processor.claimed_at += (processor.processing_duration * withdraw_awaiting_within_capacity) / processor.output_rate;

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
        move_awaiting(producer, storage, current_timestamp, None)?;
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

fn validate_by_type(processor: &Account<Processor>, storage_out: &Account<Storage>, storage_in: &Account<Storage>, storage_fuel: Option<&Account<Storage>>, current_timestamp: i64) -> Result<()> {
    require!(location::same_location_id(Some(processor.location_id), storage_in.location_id(current_timestamp)), ValidationError::DifferentLocations);

    if processor.fuel_cost_type != FuelCostType::Nothing {
        let fuel_location = storage_fuel.map(|s| s.location_id(current_timestamp)).flatten();
        require!(location::same_location_id(Some(processor.location_id), fuel_location), ValidationError::DifferentLocations);
    }

    match processor.processor_type { 
        ProcessorType::Producer => {
            require!(location::same_location_id(storage_out.location_id(current_timestamp), storage_in.location_id(current_timestamp)), ValidationError::DifferentLocations);
        },
        ProcessorType::Sender => {
        },
    }    
    Ok(())
}

pub fn produce_with_one_input(ctx: Context<ProcessesResourceWith1Input>, current_timestamp: i64) -> Result<()> {
    let processor = &mut ctx.accounts.processor;
    let resource_to_produce: &mut Account<Resource> = &mut ctx.accounts.resource_to_produce;
    let storage: &mut Account<Storage> = &mut ctx.accounts.storage;
    let storage_in: &mut Account<Storage> = &mut ctx.accounts.storage_input;
    let storage_fuel: &mut Account<Storage> = &mut ctx.accounts.storage_fuel;

    msg!("produce_with_one_input/");
    
    require!(processor.processor_type == ProcessorType::Producer, ValidationError::InvalidProcessorType);
    require!(resource_to_produce.key().eq(&storage.resource_id), ValidationError::InputStorageNotSupplied);

    validate_by_type(&processor, storage, storage_in, Some(&storage_fuel), current_timestamp)?;

    let calculated_awaiting = calc_awaiting("prod_1", current_timestamp, &processor);

    let required_input_amount = match processor.processor_type { 
        ProcessorType::Producer => {
            let input_exists = resource_to_produce.input.iter()
                .position(|input| input.key().eq(&storage_in.resource_id));

            require!(input_exists.is_some(), ValidationError::InputStorageNotSupplied);

            let index = input_exists.unwrap();
            resource_to_produce.input_amount[index]
        },

        ProcessorType::Sender => {
            let fuel_cost: i64 = 2; // distance between source and target * consumption
            require!(storage_fuel.amount >= fuel_cost, ValidationError::FuelNotEnough);
            storage_fuel.amount -= fuel_cost;
            
            match calculated_awaiting > storage_in.amount {
                true => storage_in.amount,
                false => calculated_awaiting,
            }
        },
    };

    require!(storage_in.amount >= required_input_amount, ValidationError::InputStorageAmountTooLow);

    storage_in.amount -= required_input_amount;
    processor.awaiting_units += calculated_awaiting;

    if processor.awaiting_units > 0 {
        move_awaiting(processor, storage, current_timestamp, Some(required_input_amount))?;
    }

    msg!("/produce_with_one_input");

    Ok(())
}

pub fn send(ctx: Context<SendResource>, send_amount: i64, current_timestamp: i64, from_x: i64, from_y: i64, to_x: i64, to_y: i64) -> Result<()> {
    let processor = &mut ctx.accounts.processor;
    let resource_to_produce: &mut Account<Resource> = &mut ctx.accounts.resource_to_produce;
    let storage_to: &mut Account<Storage> = &mut ctx.accounts.storage;
    let storage_from: &mut Account<Storage> = &mut ctx.accounts.storage_input;
    let storage_fuel: &mut Account<Storage> = &mut ctx.accounts.storage_fuel;
    let from_location: &Account<Location> = &ctx.accounts.from_location;
    let to_location: &Account<Location> = &ctx.accounts.to_location;

    msg!("send/");
    
    require!(processor.processor_type == ProcessorType::Sender, ValidationError::InvalidProcessorType);
    require!(resource_to_produce.key().eq(&storage_to.resource_id), ValidationError::InputStorageNotSupplied);

    require!(location::same_location_id(Some(processor.location_id), storage_from.location_id(current_timestamp)), ValidationError::DifferentLocations);

    let calculated_awaiting = match send_amount {
        //Some(amount) if amount <= storage_from.amount => amount,
        _ => storage_from.amount,
    };
    
    storage_from.amount -= calculated_awaiting;
    require!(storage_from.amount >= 0, ValidationError::InputStorageAmountTooLow);

    //storage_to.amount += calculated_awaiting;
    processor.awaiting_units += calculated_awaiting;
    move_awaiting(processor, storage_to, current_timestamp, None)?;

    if calculated_awaiting > 0 {
        let fuel_cost = match processor.fuel_cost_type {
            FuelCostType::Nothing => 0,
            FuelCostType::Distance => {
                let distance = from_location.distance(&to_location);
                let fuel_cost_per_unit = distance.pow(2);
                fuel_cost_per_unit * calculated_awaiting
            },
            FuelCostType::Output => 0,
        };

        if fuel_cost > 0 {
            let fuel_location = storage_fuel.location_id(current_timestamp);
            require!(location::same_location_id(Some(processor.location_id), fuel_location), ValidationError::DifferentLocations);

            require!(storage_fuel.amount >= fuel_cost, ValidationError::FuelNotEnough);

            storage_fuel.amount -= fuel_cost
        }
    }

    msg!("/send");

    Ok(())
}

pub fn produce_with_two_inputs(ctx: Context<ProcessesResourceWith2Inputs>, current_timestamp: i64) -> Result<()> {
    let processor = &mut ctx.accounts.processor;
    let resource_to_produce: &mut Account<Resource> = &mut ctx.accounts.resource_to_produce;
    let storage: &mut Account<Storage> = &mut ctx.accounts.storage;
    let storage_in_1: &mut Account<Storage> = &mut ctx.accounts.storage_input_1;
    let storage_in_2: &mut Account<Storage> = &mut ctx.accounts.storage_input_2;

    let input_pos_1 = resource_to_produce.input.iter().position(|input| input.key().eq(&storage_in_1.resource_id));
    require!(input_pos_1.is_some(), ValidationError::InputStorage1NotSupplied);
    let input_pos_2 = resource_to_produce.input.iter().position(|input| input.key().eq(&storage_in_2.resource_id));
    require!(input_pos_2.is_some(), ValidationError::InputStorage2NotSupplied);

    validate_by_type(&processor, storage, storage_in_1, None, current_timestamp)?;
    validate_by_type(&processor, storage, storage_in_2, None, current_timestamp)?;

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
        move_awaiting(processor, storage, current_timestamp, None)?;
    }

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
    #[account(mut)]
    pub storage_fuel: Account<'info, Storage>,
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

#[derive(Accounts)]
#[instruction(
    send_amount: i64, 
    current_timestamp: i64,
    from_x: i64,
    from_y: i64,
    to_x: i64,
    to_y: i64,
)]
pub struct SendResource<'info> {
    #[account(mut)]
    pub processor: Account<'info, Processor>,
    #[account(mut)]
    pub resource_to_produce: Account<'info, Resource>,
    #[account(mut)]
    pub storage: Account<'info, Storage>,
    #[account(mut)]
    pub storage_input: Account<'info, Storage>,
    #[account(mut)]
    pub storage_fuel: Account<'info, Storage>,
    #[account(
        mut,
        seeds = [
            b"map-location", 
            owner.key().as_ref(),
            &from_x.to_le_bytes(),
            &from_y.to_le_bytes(),
        ],
        bump = from_location.bump,
    )]
    pub from_location: Account<'info, Location>,
    #[account(
        mut,
        seeds = [
            b"map-location", 
            owner.key().as_ref(),
            &to_x.to_le_bytes(),
            &to_y.to_le_bytes(),
        ],
        bump = to_location.bump,
    )]
    pub to_location: Account<'info, Location>,
    #[account(mut)]
    pub owner: Signer<'info>,
}

