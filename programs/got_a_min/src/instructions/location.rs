use anchor_lang::prelude::*;
use crate::state::location::*;
use crate::errors::ValidationError;

pub fn init(ctx: Context<InitLocation>, name: String, position: i64, capacity: i64) -> Result<()> {
    let location: &mut Account<Location> = &mut ctx.accounts.location;
    let owner: &Signer = &ctx.accounts.owner;

    location.owner = *owner.key;
    location.name = name;
    location.position = position;
    location.occupied_space = 0;
    location.capacity = capacity;

    require!(location.name.len() <= NAME_LENGTH, ValidationError::NameTooLong);

    Ok(())
}

pub fn register_move(from_location: &mut Account<Location>, to_location: &mut Account<Location>, size: i64) -> Result<()> {
    from_location.occupied_space -= size;
    to_location.occupied_space += size;

    require!(from_location.occupied_space >= 0, ValidationError::ExperimentalError);
    require!(to_location.occupied_space <= to_location.capacity, ValidationError::LocationFull);

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
