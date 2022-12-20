use anchor_lang::prelude::*;
use crate::state::stuff::*;
use crate::errors::ValidationError;

pub fn init(ctx: Context<InitStuff>) -> Result<()> {
    let stuff: &mut Account<Stuff> = &mut ctx.accounts.stuff;

    stuff.number = 123;

    require!(stuff.number <= 1234, ValidationError::ExperimentalError);

    Ok(())
}

#[derive(Accounts)]
pub struct InitStuff<'info> {
    #[account(init, payer = owner, space = Stuff::LEN)]
    pub stuff: Account<'info, Stuff>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn update(ctx: Context<UpdateStuff>, number: i64) -> Result<()> {
    let stuff: &mut Account<Stuff> = &mut ctx.accounts.stuff;

    stuff.number = number;

    require!(stuff.number <= 1234, ValidationError::ExperimentalError);

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateStuff<'info> {
    #[account(mut)]
    pub stuff: Account<'info, Stuff>,
}
