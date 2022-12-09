use anchor_lang::prelude::*;
use errors::ValidationError;
use state::Resource;
use instructions::*;

pub mod errors;
pub mod state;
pub mod instructions;

declare_id!("5kdCwKP8D1ciS9xyc3zRp1PaUcyD2yiBFkgBr8u3jn3K");

#[program]
pub mod got_a_min {
    use super::*;

    pub fn init_resource(ctx: Context<InitResource>, name: String, inputs: Vec<Pubkey>, input_amounts: Vec<i64>) -> Result<()> {
        instructions::init_resource(ctx, name, inputs, input_amounts)
    }

    pub fn init_producer(ctx: Context<InitProducer>, resource_id: Pubkey, production_rate: i64, production_time: i64) -> Result<()> {
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

    pub fn init_storage(ctx: Context<InitStorage>, resource_id: Pubkey, capacity: i64) -> Result<()> {
        let storage: &mut Account<Storage> = &mut ctx.accounts.storage;
        let owner: &Signer = &ctx.accounts.owner;

        storage.owner = *owner.key;
        storage.resource_id = resource_id;
        storage.amount = 0;
        storage.capacity = capacity;

        Ok(())
    }

    pub fn produce_without_input(ctx: Context<ProduceResource>) -> Result<()> {
        let producer = &mut ctx.accounts.producer;
        let resource = &ctx.accounts.resource;
        let storage: &mut Account<Storage> = &mut ctx.accounts.storage;
        let current_timestamp = Clock::get()?.unix_timestamp;       // 15
        let previous_claim_at = producer.claimed_at;                // 10

        if producer.awaiting_units > 0 {
            // claim any units "done" waiting
            let diff_time = current_timestamp - previous_claim_at; // => 5
            let prod_slots_during_diff_time = diff_time / producer.production_time;
            let prod_during_diff_time = prod_slots_during_diff_time * producer.production_rate;
            let withdraw_awaiting = match producer.awaiting_units >= prod_during_diff_time {
                true => prod_during_diff_time,
                false => producer.awaiting_units,
            };
            let available_capacity = storage.capacity - storage.amount;
            let withdraw_awaiting_within_capacity = match available_capacity > withdraw_awaiting {
                true => withdraw_awaiting,
                false => available_capacity,
            };
            storage.amount += withdraw_awaiting_within_capacity;
            producer.awaiting_units -= withdraw_awaiting_within_capacity;
        }

        producer.awaiting_units += producer.production_rate;
        producer.claimed_at = current_timestamp;

        require!(resource.input.is_empty(), ValidationError::ResourceInputMax);
        require!(storage.amount <= storage.capacity, ValidationError::StorageFull);

        Ok(())
    }

    pub fn produce_with_one_input(ctx: Context<ProduceResourceWith1Input>) -> Result<()> {
        let producer = &ctx.accounts.producer;
        let resource_to_produce: &mut Account<Resource> = &mut ctx.accounts.resource_to_produce;
        let storage: &mut Account<Storage> = &mut ctx.accounts.storage;
        let storage_input: &mut Account<Storage> = &mut ctx.accounts.storage_input;

        require!(resource_to_produce.key().eq(&storage.resource_id), ValidationError::InputStorageNotSupplied);

        let input_exists = resource_to_produce.input.iter().position(|input| input.key().eq(&storage_input.resource_id));
        require!(input_exists.is_some(), ValidationError::InputStorageNotSupplied);

        let index = input_exists.unwrap();
        let required_input_amount = resource_to_produce.input_amount[index];
        require!(storage_input.amount >= required_input_amount, ValidationError::InputStorageAmountTooLow);

        storage.amount += producer.production_rate;
        storage_input.amount -= required_input_amount;

        require!(storage.amount <= storage.capacity, ValidationError::StorageFull);

        Ok(())
    }

    pub fn produce_with_two_inputs(ctx: Context<ProduceResourceWith2Inputs>) -> Result<()> {
        let producer = &ctx.accounts.producer;
        let resource_to_produce: &mut Account<Resource> = &mut ctx.accounts.resource_to_produce;
        let storage: &mut Account<Storage> = &mut ctx.accounts.storage;
        let storage_input_1: &mut Account<Storage> = &mut ctx.accounts.storage_input_1;
        let storage_input_2: &mut Account<Storage> = &mut ctx.accounts.storage_input_2;

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

        storage.amount += producer.production_rate;
        storage_input_1.amount -= input_1_amount;
        storage_input_2.amount -= input_2_amount;

        require!(storage.amount <= storage.capacity, ValidationError::StorageFull);

        Ok(())
    }
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
pub struct InitStorage<'info> {
    #[account(init, payer = owner, space = Storage::LEN)]
    pub storage: Account<'info, Storage>,
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

#[account]
pub struct Producer {
    pub owner: Pubkey,
    pub resource_id: Pubkey,
    pub production_rate: i64,   // Produce this many units per [production_time]. 
    pub production_time: i64,   
    pub awaiting_units: i64,    // This amount can be claimed after waiting [production_time] * [awaiting_units] seconds.
    pub claimed_at: i64,
}

impl Producer {
    const LEN: usize = DISCRIMINATOR_LENGTH
        + PUBLIC_KEY_LENGTH  // owner
        + PUBLIC_KEY_LENGTH  // resource_id
        + PRODUCTION_RATE_LENGTH
        + PRODUCTION_TIME_LENGTH
        + AWAITING_UNITS_LENGTH
        + CLAIMED_AT_LENGTH;
}

#[account]
pub struct Storage {
    pub owner: Pubkey,
    pub resource_id: Pubkey,
    pub amount: i64,
    pub capacity: i64,
}

impl Storage {
    const LEN: usize = DISCRIMINATOR_LENGTH
        + PUBLIC_KEY_LENGTH  // owner
        + PUBLIC_KEY_LENGTH  // resource_id
        + AMOUNT_LENGTH
        + CAPACITY_LENGTH;
}

const AMOUNT_LENGTH: usize = 8;
const AWAITING_UNITS_LENGTH: usize = 8;
const CAPACITY_LENGTH: usize = 8;
const CLAIMED_AT_LENGTH: usize = 8;
const DISCRIMINATOR_LENGTH: usize = 8;
const INPUT_AMOUNT_LENGTH: usize = 8 * INPUT_MAX_SIZE;
const INPUT_LENGTH: usize = PUBLIC_KEY_LENGTH * INPUT_MAX_SIZE;
const INPUT_MAX_SIZE: usize = 2;
const NAME_LENGTH: usize = 16 * 4;
const PRODUCTION_RATE_LENGTH: usize = 8;
const PRODUCTION_TIME_LENGTH: usize = 8;
const PUBLIC_KEY_LENGTH: usize = 32;
