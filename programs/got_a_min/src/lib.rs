use anchor_lang::prelude::*;

declare_id!("5kdCwKP8D1ciS9xyc3zRp1PaUcyD2yiBFkgBr8u3jn3K");

#[error_code]
pub enum ValidationError {
    #[msg("Resource has too many inputs defined.")]                             ResourceInputMax,
    #[msg("Missing resource input amount.")]                                    MissingResourceInputAmount,
    #[msg("Missing resource account.")]                                         MissingResource,
    #[msg("Input resource not supplied to production.")]                        InputResourceNotSupplied,
    #[msg("Input resource 1 not supplied to production.")]                      InputResource1NotSupplied,
    #[msg("Input resource 2 not supplied to production.")]                      InputResource2NotSupplied,
    #[msg("Input resource amount is too low.")]                                 InputResourceAmountTooLow,
    #[msg("Trying stuff out and failing quite deliberately.")]                  ExperimentalError,
}

#[program]
pub mod got_a_min {
    use super::*;

    pub fn init_resource(ctx: Context<InitResource>, name: String, inputs: Vec<Pubkey>, input_amounts: Vec<i64>) -> Result<()> {
        let resource: &mut Account<Resource> = &mut ctx.accounts.resource;
        let owner: &Signer = &ctx.accounts.owner;

        resource.owner = *owner.key;
        resource.amount = 0;
        resource.name = name;
        resource.input = inputs;
        resource.input_amount = input_amounts;

        require!(resource.input.len() <= INPUT_MAX_SIZE, ValidationError::ResourceInputMax);
        require!(resource.input.len() == resource.input_amount.len(), ValidationError::MissingResourceInputAmount);

        Ok(())
    }

    pub fn init_producer(ctx: Context<InitProducer>, resource_id: Pubkey, production_rate: i64) -> Result<()> {
        let producer: &mut Account<Producer> = &mut ctx.accounts.producer;
        let owner: &Signer = &ctx.accounts.owner;

        producer.owner = *owner.key;
        producer.resource_id = resource_id;
        producer.production_rate = production_rate;

        Ok(())
    }

    pub fn init_storage(ctx: Context<InitStorage>, resource_id: Pubkey) -> Result<()> {
        let storage: &mut Account<Storage> = &mut ctx.accounts.storage;
        let owner: &Signer = &ctx.accounts.owner;

        storage.owner = *owner.key;
        storage.resource_id = resource_id;
        storage.amount = 0;

        Ok(())
    }

    pub fn produce(ctx: Context<ProduceResource>) -> Result<()> {
        let producer = &ctx.accounts.producer;
        let resource: &mut Account<Resource> = &mut ctx.accounts.resource;

        resource.amount += producer.production_rate;

        require!(resource.input.is_empty(), ValidationError::ResourceInputMax);

        Ok(())
    }

    pub fn produce_with_one_input(ctx: Context<ProduceResourceWith1Input>) -> Result<()> {
        let producer = &ctx.accounts.producer;
        let resource_to_produce: &mut Account<Resource> = &mut ctx.accounts.resource_to_produce;
        let resource_input: &mut Account<Resource> = &mut ctx.accounts.resource_input;

        let input_exists = resource_to_produce.input.iter().position(|input| input.key().eq(&resource_input.key()));
        require!(input_exists.is_some(), ValidationError::InputResourceNotSupplied);

        let index = input_exists.unwrap();
        let input_amount = resource_to_produce.input_amount[index];
        require!(resource_input.amount >= input_amount, ValidationError::InputResourceAmountTooLow);

        resource_to_produce.amount += producer.production_rate;
        resource_input.amount -= input_amount;

        Ok(())
    }

    pub fn produce_with_two_inputs(ctx: Context<ProduceResourceWith2Inputs>) -> Result<()> {
        let producer = &ctx.accounts.producer;
        let resource_to_produce: &mut Account<Resource> = &mut ctx.accounts.resource_to_produce;
        let resource_input_1: &mut Account<Resource> = &mut ctx.accounts.resource_input_1;
        let resource_input_2: &mut Account<Resource> = &mut ctx.accounts.resource_input_2;

        let input_pos_1 = resource_to_produce.input.iter().position(|input| input.key().eq(&resource_input_1.key()));
        require!(input_pos_1.is_some(), ValidationError::InputResource1NotSupplied);
        let input_pos_2 = resource_to_produce.input.iter().position(|input| input.key().eq(&resource_input_2.key()));
        require!(input_pos_2.is_some(), ValidationError::InputResource2NotSupplied);

        let index_1 = input_pos_1.unwrap();
        let input_1_amount = resource_to_produce.input_amount[index_1];
        require!(resource_input_1.amount >= input_1_amount, ValidationError::InputResourceAmountTooLow);

        let index_2 = input_pos_2.unwrap();
        let input_2_amount = resource_to_produce.input_amount[index_2];
        require!(resource_input_2.amount >= input_2_amount, ValidationError::InputResourceAmountTooLow);

        resource_to_produce.amount += producer.production_rate;
        resource_input_1.amount -= input_1_amount;
        resource_input_2.amount -= input_2_amount;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitResource<'info> {
    #[account(init, payer = owner, space = Resource::LEN)]
    pub resource: Account<'info, Resource>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
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
}

#[derive(Accounts)]
pub struct ProduceResourceWith1Input<'info> {
    #[account(mut)]
    pub producer: Account<'info, Producer>,
    #[account(mut)]
    pub resource_to_produce: Account<'info, Resource>,
    #[account(mut)]
    pub resource_input: Account<'info, Resource>,
}

#[derive(Accounts)]
pub struct ProduceResourceWith2Inputs<'info> {
    #[account(mut)]
    pub producer: Account<'info, Producer>,
    #[account(mut)]
    pub resource_to_produce: Account<'info, Resource>,
    #[account(mut)]
    pub resource_input_1: Account<'info, Resource>,
    #[account(mut)]
    pub resource_input_2: Account<'info, Resource>,
}

#[account]
pub struct Producer {
    pub owner: Pubkey,
    pub resource_id: Pubkey,
    pub production_rate: i64,
}

impl Producer {
    const LEN: usize = DISCRIMINATOR_LENGTH
        + PUBLIC_KEY_LENGTH  // owner
        + PUBLIC_KEY_LENGTH  // resource_id
        + PRODUCTION_RATE_LENGTH
        + INPUT_LENGTH;
}

#[account]
pub struct Resource {
    pub owner: Pubkey,
    pub amount: i64,
    pub name: String,
    pub input: Vec<Pubkey>,
    pub input_amount: Vec<i64>,
}

impl Resource {
    const LEN: usize = DISCRIMINATOR_LENGTH
        + PUBLIC_KEY_LENGTH
        + AMOUNT_LENGTH
        + NAME_LENGTH 
        + INPUT_LENGTH
        + INPUT_AMOUNT_LENGTH;          
}

#[account]
pub struct Storage {
    pub owner: Pubkey,
    pub resource_id: Pubkey,
    pub amount: i64,
}

impl Storage {
    const LEN: usize = DISCRIMINATOR_LENGTH
        + PUBLIC_KEY_LENGTH  // owner
        + PUBLIC_KEY_LENGTH  // resource_id
        + AMOUNT_LENGTH;
}

const DISCRIMINATOR_LENGTH: usize = 8;
const PUBLIC_KEY_LENGTH: usize = 32;
const PRODUCTION_RATE_LENGTH: usize = 8;
const AMOUNT_LENGTH: usize = 8;
const NAME_LENGTH: usize = 16 * 4;
const INPUT_MAX_SIZE: usize = 2;
const INPUT_LENGTH: usize = PUBLIC_KEY_LENGTH * INPUT_MAX_SIZE;
const INPUT_AMOUNT_LENGTH: usize = 8 * INPUT_MAX_SIZE;
