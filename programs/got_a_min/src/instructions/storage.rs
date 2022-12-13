use anchor_lang::prelude::*;

use crate::state::{storage::*, Location};
use crate::instructions::location;
use crate::errors::ValidationError;

pub fn init(ctx: Context<InitStorage>, resource_id: Pubkey, location_id: Pubkey, capacity: i64) -> Result<()> {
    let storage: &mut Account<Storage> = &mut ctx.accounts.storage;
    let owner: &Signer = &ctx.accounts.owner;

    storage.owner = *owner.key;
    storage.resource_id = resource_id;
    storage.location_id = location_id;
    storage.amount = 0;
    storage.capacity = capacity;

    Ok(())
}

#[derive(Accounts)]
pub struct InitStorage<'info> {
    #[account(init, payer = owner, space = Storage::LEN)]
    pub storage: Account<'info, Storage>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn move_between(ctx: Context<MoveBetweenStorage>, amount: i64) -> Result<()> {
    let storage_from: &mut Account<Storage> = &mut ctx.accounts.storage_from;
    let storage_to: &mut Account<Storage> = &mut ctx.accounts.storage_to;
    let _owner: &Signer = &ctx.accounts.owner;

    storage_from.remove(amount)?;
    storage_to.add(amount)?;
    
    require!(storage_from.resource_id == storage_to.resource_id, ValidationError::ResourceNotMatching);
    require!(storage_from.location_id == storage_to.location_id, ValidationError::DifferentLocations);

    Ok(())
}

#[derive(Accounts)]
pub struct MoveBetweenStorage<'info> {
    #[account(mut)]
    pub storage_from: Account<'info, Storage>,
    #[account(mut)]
    pub storage_to: Account<'info, Storage>,
    #[account(mut)]
    pub owner: Signer<'info>,
}

pub fn move_to_location(ctx: Context<MoveStorage>) -> Result<()> {
    let storage: &mut Account<Storage> = &mut ctx.accounts.storage;
    let from_location: &mut Account<Location> = &mut ctx.accounts.from_location;
    let to_location: &mut Account<Location> = &mut ctx.accounts.to_location;
    let _owner: &Signer = &ctx.accounts.owner;

    location::register_move(from_location, to_location)
}

#[derive(Accounts)]
pub struct MoveStorage<'info> {
    #[account(mut)]
    pub storage: Account<'info, Storage>,
    #[account(mut)]
    pub from_location: Account<'info, Location>,
    #[account(mut)]
    pub to_location: Account<'info, Location>,
    #[account(mut)]
    pub owner: Signer<'info>,
}
