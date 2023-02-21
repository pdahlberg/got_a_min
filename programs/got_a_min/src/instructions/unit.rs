use anchor_lang::prelude::*;
use crate::state::{unit::*, Location, LocationType, Map};
use crate::errors::ValidationError;

pub fn init(ctx: Context<InitUnit>, name: String, _x: i64, _y: i64) -> Result<()> {
    let unit: &mut Account<Unit> = &mut ctx.accounts.unit;
    let location: &Account<Location> = &ctx.accounts.location;
    let owner: &Signer = &ctx.accounts.owner;

    require!(location.location_type != LocationType::Unexplored, ValidationError::LocationUnexplored);

    unit.owner = *owner.key;
    unit.name = name;
    unit.at_location_id = location.key();
    unit.movement_speed = 1;
    unit.arrives_at = 0;
    unit.bump = *ctx.bumps.get("unit").unwrap();

    require!(unit.name.len() <= NAME_LENGTH, ValidationError::NameTooLong);

    Ok(())
}

fn string_to_seed(value: &str) -> &[u8] {
    //let b = value.as_bytes();
    //if b.len() > 32 { &b[0..32] } else { b }
    value.as_bytes()
}

#[derive(Accounts)]
#[instruction(name: String, x: i64, y: i64)]
pub struct InitUnit<'info> {
    #[account(
        init, 
        payer = owner, 
        space = Unit::LEN,
        seeds = [
            b"unit", 
            owner.key().as_ref(),
            &string_to_seed(&name),
        ],
        bump,
    )]
    pub unit: Account<'info, Unit>,
    #[account(
        seeds = [
            b"map-location", 
            owner.key().as_ref(),
            &x.to_le_bytes(),
            &y.to_le_bytes(),
        ],
        bump = location.bump,
    )]
    pub location: Account<'info, Location>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn move_unit_start(ctx: Context<MoveUnitStart>, _from_x: i64, _from_y: i64, _to_x: i64, _to_y: i64, _name: String, current_timestamp: i64) -> Result<()> {
    let unit: &mut Account<Unit> = &mut ctx.accounts.unit;
    let from_location: &Account<Location> = &ctx.accounts.from_location;
    let to_location: &mut Account<Location> = &mut ctx.accounts.to_location;

    require!(unit.at_location_id == from_location.key(), ValidationError::ExperimentalError);
    require!(from_location.distance(to_location) == 1, ValidationError::UnitMoveInvalid);
    require!(unit.movement_speed > 0, ValidationError::ExperimentalError);
    require!(!unit.is_moving(current_timestamp), ValidationError::NotAllowedWhileMoving);

    unit.at_location_id = to_location.key();
    let distance_time = from_location.distance_time(to_location);
    let travel_time = distance_time / unit.movement_speed;
    unit.arrives_at = match travel_time {
        0 => 0,
        _ => current_timestamp + travel_time,
    };

    Ok(())
}

pub fn move_unit_complete(ctx: Context<MoveUnitComplete>, _to_x: i64, _to_y: i64, _name: String, current_timestamp: i64) -> Result<()> {
    let unit: &mut Account<Unit> = &mut ctx.accounts.unit;
    let to_location: &mut Account<Location> = &mut ctx.accounts.to_location;
    let map: &mut Account<Map> = &mut ctx.accounts.map;

    if unit.arrives_at > 0 && unit.location_id(current_timestamp) == Some(to_location.key()) {
        unit.arrives_at = 0;
    if to_location.location_type == LocationType::Unexplored {
        to_location.explore(map);
        }
    }

    Ok(())
}

#[derive(Accounts)]
#[instruction(from_x: i64, from_y: i64, to_x: i64, to_y: i64, name: String)]
pub struct MoveUnitStart<'info> {
    #[account(
        mut,
        seeds = [
            b"unit", 
            owner.key().as_ref(),
            &string_to_seed(&name),
        ],
        bump = unit.bump,
    )]
    pub unit: Account<'info, Unit>,
    #[account(
        mut,
        seeds = [
            b"map-location", 
            owner.key().as_ref(),
            &from_x.to_le_bytes(),
            &from_y.to_le_bytes(),
        ],
        bump = from_location.bump,
    )]
    pub from_location: Account<'info, Location>,
    #[account(
        mut,
        seeds = [
            b"map-location", 
            owner.key().as_ref(),
            &to_x.to_le_bytes(),
            &to_y.to_le_bytes(),
        ],
        bump = to_location.bump,
    )]
    pub to_location: Account<'info, Location>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(to_x: i64, to_y: i64, name: String)]
pub struct MoveUnitComplete<'info> {
    #[account(
        mut,
        seeds = [
            b"unit", 
            owner.key().as_ref(),
            &string_to_seed(&name),
        ],
        bump = unit.bump,
    )]
    pub unit: Account<'info, Unit>,
    #[account(
        mut,
        seeds = [
            b"map-location", 
            owner.key().as_ref(),
            &to_x.to_le_bytes(),
            &to_y.to_le_bytes(),
        ],
        bump = to_location.bump,
    )]
    pub to_location: Account<'info, Location>,
    #[account(mut)]
    pub map: Account<'info, Map>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}


