use anchor_lang::prelude::*;
use crate::state::location::*;
use crate::errors::ValidationError;

pub fn init_location(ctx: Context<InitLocation>, name: String, position: i64, capacity: i64) -> Result<()> {
    let location: &mut Account<Location> = &mut ctx.accounts.location;
    let owner: &Signer = &ctx.accounts.owner;

    location.owner = *owner.key;
    location.name = name;
    location.position = position;
    location.capacity = capacity;

    require!(location.name.len() <= NAME_LENGTH, ValidationError::NameTooLong);

    Ok(())
}

#[derive(Accounts)]
pub struct InitLocation<'info> {
    #[account(init, payer = owner, space = Location::LEN)]
    pub location: Account<'info, Location>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}
