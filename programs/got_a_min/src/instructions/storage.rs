use anchor_lang::prelude::*;

use crate::state::{storage::*, Location};
use crate::instructions::location;
use crate::errors::ValidationError;

pub fn init(ctx: Context<InitStorage>, resource_id: Pubkey, capacity: i64, mobility_type: MobilityType) -> Result<()> {
    let storage: &mut Account<Storage> = &mut ctx.accounts.storage;
    let location: &mut Account<Location> = &mut ctx.accounts.location;
    let owner: &Signer = &ctx.accounts.owner;

    storage.owner = *owner.key;
    storage.resource_id = resource_id;
    storage.location_id = location.key();
    storage.amount = 0;
    storage.capacity = capacity;
    storage.mobility_type = mobility_type;

    location.add(storage.size())
}

#[derive(Accounts)]
pub struct InitStorage<'info> {
    #[account(init, payer = owner, space = Storage::LEN)]
    pub storage: Account<'info, Storage>,
    #[account(mut)]
    pub location: Account<'info, Location>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn move_between(ctx: Context<MoveBetweenStorage>, amount: i64) -> Result<()> {
    let from_storage: &mut Account<Storage> = &mut ctx.accounts.storage_from;
    let to_storage: &mut Account<Storage> = &mut ctx.accounts.storage_to;
    let _owner: &Signer = &ctx.accounts.owner;

    from_storage.remove(amount)?;
    to_storage.add(amount, from_storage.location_id)?;
    
    require!(from_storage.resource_id == to_storage.resource_id, ValidationError::ResourceNotMatching);
    require!(from_storage.location_id == to_storage.location_id, ValidationError::DifferentLocations);

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

    require!(storage.mobility_type == MobilityType::Movable, ValidationError::StorageTypeNotMovable);

    storage.location_id = to_location.key();
    location::register_move(from_location, to_location, 1)
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
