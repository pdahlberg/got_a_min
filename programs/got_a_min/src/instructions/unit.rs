use anchor_lang::prelude::*;
use crate::state::{unit::*, Location};
use crate::errors::ValidationError;

pub fn init(ctx: Context<InitUnit>, name: String, position: [u8; 2]) -> Result<()> {
    let unit: &mut Account<Unit> = &mut ctx.accounts.unit;
    let location: &Account<Location> = &ctx.accounts.location;
    let owner: &Signer = &ctx.accounts.owner;

    unit.owner = *owner.key;
    unit.name = name;
    unit.at_location_id = location.key();
    unit.bump = *ctx.bumps.get("unit").unwrap();

    require!(unit.name.len() <= NAME_LENGTH, ValidationError::NameTooLong);

    Ok(())
}

fn string_to_seed(value: &str) -> &[u8] {
    let b = value.as_bytes();
    if b.len() > 32 { &b[0..32] } else { b }
}

#[derive(Accounts)]
#[instruction(name: String, position: [u8; 2],)]
pub struct InitUnit<'info> {
    #[account(
        init, 
        payer = owner, 
        space = Unit::LEN,
        seeds = [
            b"unit", 
            owner.key().as_ref(),
            //&string_to_seed(&name), // let's start with only one
        ],
        bump,
    )]
    pub unit: Account<'info, Unit>,
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

pub fn move_unit(ctx: Context<MoveUnit>, from_pos: [u8; 2], to_pos: [u8; 2]) -> Result<()> {
    let unit: &mut Account<Unit> = &mut ctx.accounts.unit;
    let from_location: &Account<Location> = &ctx.accounts.from_location;
    let to_location: &Account<Location> = &ctx.accounts.to_location;

    require!(unit.at_location_id == from_location.key(), ValidationError::ExperimentalError);

    unit.at_location_id = to_location.key();
    
    Ok(())
}

#[derive(Accounts)]
#[instruction(from_pos: [u8; 2], to_pos: [u8; 2])]
pub struct MoveUnit<'info> {
    #[account(
        mut,
        seeds = [
            b"unit", 
            owner.key().as_ref(),
        ],
        bump = unit.bump,
    )]
    pub unit: Account<'info, Unit>,
    #[account(
        mut,
        seeds = [
            b"map-location", 
            owner.key().as_ref(),
            &from_pos,
        ],
        bump = from_location.bump,
    )]
    pub from_location: Account<'info, Location>,
    #[account(
        mut,
        seeds = [
            b"map-location", 
            owner.key().as_ref(),
            &to_pos,
        ],
        bump = to_location.bump,
    )]
    pub to_location: Account<'info, Location>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}


