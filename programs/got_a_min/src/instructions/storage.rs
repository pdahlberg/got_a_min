use anchor_lang::prelude::*;

use crate::state::{storage::*, Location, OwnershipRef};
use crate::instructions::location;
use crate::errors::ValidationError;

pub fn init(
    ctx: Context<InitStorage>,
    resource_id: Pubkey,
    capacity: i64,
    mobility_type: MobilityType,
    movement_speed: i64,
    position: [u8; 2],
) -> Result<()> {
    let storage: &mut Account<Storage> = &mut ctx.accounts.storage;
    let location: &mut Account<Location> = &mut ctx.accounts.location;
    let owner: &Signer = &ctx.accounts.owner;

    storage.owner = owner.key();
    storage.resource_id = resource_id;
    storage.location_id = location.key();
    storage.amount = 0;
    storage.capacity = capacity;
    storage.mobility_type = mobility_type;
    storage.movement_speed = movement_speed;
    storage.arrives_at = 0;

    location.add(owner, OwnershipRef { item: storage.key(), player: owner.key() })
}

#[derive(Accounts)]
#[instruction(
    resource_id: Pubkey,
    capacity: i64,
    mobility_type: MobilityType,
    movement_speed: i64,
    position: [u8; 2],
)]
pub struct InitStorage<'info> {
    #[account(init, payer = owner, space = Storage::LEN)]
    pub storage: Account<'info, Storage>,
    #[account(
        mut,
        seeds = [
            b"map-location", 
            owner.key().as_ref(),
            &position,
        ],
        bump = location.bump,
    )]
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
    let owner: &Signer = &ctx.accounts.owner;
    let now = (Clock::get()?).unix_timestamp;

    require!(storage.mobility_type == MobilityType::Movable, ValidationError::StorageTypeNotMovable);
    require!(storage.movement_speed > 0, ValidationError::StorageTypeNotMovable);
    require!(!storage.is_moving(now), ValidationError::NotAllowedWhileMoving);

    storage.location_id = to_location.key();
    let distance = from_location.distance(to_location);
    let travel_time = distance / storage.movement_speed;
    storage.arrives_at = match travel_time {
        0 => 0,
        _ => now + travel_time,
    };


    location::register_move(owner, from_location, to_location, OwnershipRef { item: storage.key(), player: storage.owner })
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

pub fn update_move_status(ctx: Context<UpdateStorageMoveStatus>) -> Result<()> {
    let storage: &mut Account<Storage> = &mut ctx.accounts.storage;
    let now = (Clock::get()?).unix_timestamp;

    require!(storage.mobility_type == MobilityType::Movable, ValidationError::StorageTypeNotMovable);
    require!(storage.movement_speed > 0, ValidationError::StorageTypeNotMovable);
    
    if storage.has_arrived(now) {
        storage.arrives_at = 0;
    }

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateStorageMoveStatus<'info> {
    #[account(mut)]
    pub storage: Account<'info, Storage>,
    #[account(mut)]
    pub owner: Signer<'info>,
}


// simple init
#[derive(Accounts)]
#[instruction(xy: [u8; 2])]
pub struct SimpleInitStorage<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(init, payer = owner, space = Storage::LEN)]
    pub storage: Account<'info, Storage>,
    #[account(
        mut,
        seeds = [
            b"map-location", 
            owner.key().as_ref(),
            &xy,
        ],
        bump = location.bump,
    )]
    pub location: Account<'info, Location>,
    pub system_program: Program<'info, System>,
}
pub fn simple_init(
    ctx: Context<SimpleInitStorage>, xy: [u8; 2]) -> Result<()> {
    let storage: &mut Account<Storage> = &mut ctx.accounts.storage;
    //let location: &mut Account<Location> = &mut ctx.accounts.location;
    let owner: &Signer = &ctx.accounts.owner;

    //require!(position[0] > position[1], ValidationError::ExperimentalError);

    storage.owner = owner.key();
    storage.resource_id = owner.key();
    storage.location_id = owner.key();
    storage.amount = 0;
    storage.capacity = 10;
    storage.mobility_type = MobilityType::Fixed;
    storage.movement_speed = 1;
    storage.arrives_at = 0;
    Ok(())
}

#[derive(Accounts)]
#[instruction(xy: [u8; 2])]
pub struct SimpleTestStorage<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut)]
    pub storage: Account<'info, Storage>,
    #[account(
        mut,
        seeds = [
            b"map-location", 
            owner.key().as_ref(),
            &xy,
        ],
        bump = location.bump,
    )]
    pub location: Account<'info, Location>,
    pub system_program: Program<'info, System>,
}
pub fn simple_test(
    ctx: Context<SimpleTestStorage>, position: [u8; 2]) -> Result<()> {
    let storage: &mut Account<Storage> = &mut ctx.accounts.storage;
    let location: &mut Account<Location> = &mut ctx.accounts.location;

    require!(position[0] < position[1], ValidationError::ExperimentalError);

    Ok(())
}
