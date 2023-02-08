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
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn move_unit(ctx: Context<MoveUnit>, _from_x: i64, _from_y: i64, _to_x: i64, _to_y: i64, _name: String, current_timestamp: i64) -> Result<()> {
    let unit: &mut Account<Unit> = &mut ctx.accounts.unit;
    let from_location: &Account<Location> = &ctx.accounts.from_location;
    let to_location: &mut Account<Location> = &mut ctx.accounts.to_location;
    let map: &mut Account<Map> = &mut ctx.accounts.map;

    require!(unit.at_location_id == from_location.key(), ValidationError::ExperimentalError);

    if to_location.location_type == LocationType::Unexplored {
        to_location.explore(map);
    }

    unit.at_location_id = to_location.key();
    
    Ok(())
}

#[derive(Accounts)]
#[instruction(from_x: i64, from_y: i64, to_x: i64, to_y: i64, name: String)]
pub struct MoveUnit<'info> {
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
    pub map: Account<'info, Map>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}


