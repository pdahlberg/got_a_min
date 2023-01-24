use anchor_lang::prelude::*;
use crate::state::{stuff::*, Location};
use crate::errors::ValidationError;

pub fn init(ctx: Context<InitStuff>, x: i64, y: i64) -> Result<()> {
    //msg!("num: {}", num);
    //num.to_le_bytes().iter().for_each(|i| msg!("i: {}", i));
    Ok(())
}

#[derive(Accounts)]
#[instruction(x: i64, y: i64)]
pub struct InitStuff<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [
            b"map-location", 
            owner.key().as_ref(),
            &x.to_le_bytes(),
            &y.to_le_bytes(),
        ],
        bump = location.bump,
    )]
    pub location: Account<'info, Location>,
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
