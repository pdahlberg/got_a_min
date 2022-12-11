use anchor_lang::prelude::*;
use crate::state::resource::*;
use crate::errors::ValidationError;

pub fn init_resource(ctx: Context<InitResource>, name: String, inputs: Vec<Pubkey>, input_amounts: Vec<i64>) -> Result<()> {
    let resource: &mut Account<Resource> = &mut ctx.accounts.resource;
    let owner: &Signer = &ctx.accounts.owner;

    resource.owner = *owner.key;
    resource.name = name;
    resource.input = inputs;
    resource.input_amount = input_amounts;

    require!(resource.input.len() <= INPUT_MAX_SIZE, ValidationError::ResourceInputMax);
    require!(resource.input.len() == resource.input_amount.len(), ValidationError::MissingResourceInputAmount);

    Ok(())
}

#[derive(Accounts)]
pub struct InitResource<'info> {
    #[account(init, payer = owner, space = Resource::LEN)]
    pub resource: Account<'info, Resource>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}
