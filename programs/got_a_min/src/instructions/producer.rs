use anchor_lang::prelude::*;
use crate::state::producer::*;
use crate::state::resource::*;
use crate::state::storage::*;
use crate::errors::ValidationError;

pub fn init(ctx: Context<InitProducer>, resource_id: Pubkey, production_rate: i64, production_time: i64) -> Result<()> {
    let producer: &mut Account<Producer> = &mut ctx.accounts.producer;
    let owner: &Signer = &ctx.accounts.owner;
    let clock = Clock::get()?;

    producer.owner = *owner.key;
    producer.resource_id = resource_id;
    producer.production_rate = production_rate;
    producer.production_time = production_time;
    producer.awaiting_units = 0;
    producer.claimed_at = clock.unix_timestamp;

    Ok(())
}

// claim any units "done" waiting
fn move_awaiting(producer: &mut Account<Producer>, storage: &mut Account<Storage>, current_timestamp: i64) -> Result<()> {
    let withdraw_awaiting = match producer.production_time == 0 {
        true => producer.awaiting_units,
        false => {
            let previous_claim_at = producer.claimed_at;
            let diff_time = current_timestamp - previous_claim_at;
            let prod_slots_during_diff_time = diff_time / producer.production_time;
            let prod_during_diff_time = prod_slots_during_diff_time * producer.production_rate;
            let withdraw_awaiting = match producer.awaiting_units >= prod_during_diff_time {
                true => prod_during_diff_time,
                false => producer.awaiting_units,
            };
            withdraw_awaiting
        }
    };

    let available_capacity = storage.capacity - storage.amount;
    let withdraw_awaiting_within_capacity = match available_capacity > withdraw_awaiting {
        true => withdraw_awaiting,
        false => available_capacity,
    };

    storage.add(withdraw_awaiting_within_capacity)?;
    producer.awaiting_units -= withdraw_awaiting_within_capacity;

    Ok(())
}

pub fn produce_without_input(ctx: Context<ProduceResource>) -> Result<()> {
    let producer = &mut ctx.accounts.producer;
    let resource = &ctx.accounts.resource;
    let storage: &mut Account<Storage> = &mut ctx.accounts.storage;
    let current_timestamp = Clock::get()?.unix_timestamp;

    producer.awaiting_units += producer.production_rate;

    if producer.awaiting_units > 0 {
        move_awaiting(producer, storage, current_timestamp)?;
    }

    producer.claimed_at = current_timestamp;

    require!(resource.input.is_empty(), ValidationError::ResourceInputMax);

    Ok(())
}

pub fn produce_with_one_input(ctx: Context<ProduceResourceWith1Input>) -> Result<()> {
    let producer = &mut ctx.accounts.producer;
    let resource_to_produce: &mut Account<Resource> = &mut ctx.accounts.resource_to_produce;
    let storage: &mut Account<Storage> = &mut ctx.accounts.storage;
    let storage_input: &mut Account<Storage> = &mut ctx.accounts.storage_input;
    let current_timestamp = Clock::get()?.unix_timestamp;       // 15
 
    require!(resource_to_produce.key().eq(&storage.resource_id), ValidationError::InputStorageNotSupplied);

    let input_exists = resource_to_produce.input.iter().position(|input| input.key().eq(&storage_input.resource_id));
    require!(input_exists.is_some(), ValidationError::InputStorageNotSupplied);

    let index = input_exists.unwrap();
    let required_input_amount = resource_to_produce.input_amount[index];
    require!(storage_input.amount >= required_input_amount, ValidationError::InputStorageAmountTooLow);


    storage_input.amount -= required_input_amount;
    producer.awaiting_units += producer.production_rate;

    if producer.awaiting_units > 0 {
        move_awaiting(producer, storage, current_timestamp)?;
    }

    producer.claimed_at = current_timestamp;

    Ok(())
}

pub fn produce_with_two_inputs(ctx: Context<ProduceResourceWith2Inputs>) -> Result<()> {
    let producer = &mut ctx.accounts.producer;
    let resource_to_produce: &mut Account<Resource> = &mut ctx.accounts.resource_to_produce;
    let storage: &mut Account<Storage> = &mut ctx.accounts.storage;
    let storage_input_1: &mut Account<Storage> = &mut ctx.accounts.storage_input_1;
    let storage_input_2: &mut Account<Storage> = &mut ctx.accounts.storage_input_2;
    let current_timestamp = Clock::get()?.unix_timestamp; 

    let input_pos_1 = resource_to_produce.input.iter().position(|input| input.key().eq(&storage_input_1.resource_id));
    require!(input_pos_1.is_some(), ValidationError::InputStorage1NotSupplied);
    let input_pos_2 = resource_to_produce.input.iter().position(|input| input.key().eq(&storage_input_2.resource_id));
    require!(input_pos_2.is_some(), ValidationError::InputStorage2NotSupplied);

    let index_1 = input_pos_1.unwrap();
    let input_1_amount = resource_to_produce.input_amount[index_1];
    require!(storage_input_1.amount >= input_1_amount, ValidationError::InputStorageAmountTooLow);

    let index_2 = input_pos_2.unwrap();
    let input_2_amount = resource_to_produce.input_amount[index_2];
    require!(storage_input_2.amount >= input_2_amount, ValidationError::InputStorageAmountTooLow);

    storage_input_1.amount -= input_1_amount;
    storage_input_2.amount -= input_2_amount;
    producer.awaiting_units += producer.production_rate;

    if producer.awaiting_units > 0 {
        move_awaiting(producer, storage, current_timestamp)?;
    }

    producer.claimed_at = current_timestamp;

    Ok(())
}

#[derive(Accounts)]
pub struct InitProducer<'info> {
    #[account(init, payer = owner, space = Producer::LEN)]
    pub producer: Account<'info, Producer>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ProduceResource<'info> {
    #[account(mut)]
    pub producer: Account<'info, Producer>,
    #[account(mut)]
    pub resource: Account<'info, Resource>,
    #[account(mut)]
    pub storage: Account<'info, Storage>,
}

#[derive(Accounts)]
pub struct ProduceResourceWith1Input<'info> {
    #[account(mut)]
    pub producer: Account<'info, Producer>,
    #[account(mut)]
    pub resource_to_produce: Account<'info, Resource>,
    #[account(mut)]
    pub storage: Account<'info, Storage>,
    #[account(mut)]
    pub storage_input: Account<'info, Storage>,
}

#[derive(Accounts)]
pub struct ProduceResourceWith2Inputs<'info> {
    #[account(mut)]
    pub producer: Account<'info, Producer>,
    #[account(mut)]
    pub resource_to_produce: Account<'info, Resource>,
    #[account(mut)]
    pub storage: Account<'info, Storage>,
    #[account(mut)]
    pub storage_input_1: Account<'info, Storage>,
    #[account(mut)]
    pub storage_input_2: Account<'info, Storage>,
}
