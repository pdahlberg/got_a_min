use anchor_lang::prelude::*;
use std::hash::{Hasher, Hash};
use std::collections::hash_map::DefaultHasher;
use crate::state::location::*;
use crate::errors::ValidationError;

pub fn init(ctx: Context<InitLocation>, name: String, position: [u8; 2], x: i64, y: i64, capacity: i64, location_type: Option<LocationType>) -> Result<()> {
    let location: &mut Account<Location> = &mut ctx.accounts.location;
    let owner: &Signer = &ctx.accounts.owner;

    location.owner = *owner.key;
    location.name = name;
    location.pos_x = position[0];
    location.pos_y = position[1];
    location.occupied_space = 0;
    location.capacity = capacity;
    location.occupied_by = vec!();
    location.location_type = match location_type {
        Some(loc_type) => loc_type,
        None => LocationType::Unexplored,
    };
    location.bump = *ctx.bumps.get("location").unwrap();

    require!(location.name.len() <= NAME_LENGTH, ValidationError::NameTooLong);

    Ok(())
}

pub fn register_move(owner: &Signer, from_location: &mut Account<Location>, to_location: &mut Account<Location>, ownership_ref: OwnershipRef) -> Result<()> {
    from_location.remove(owner, &ownership_ref)?;
    to_location.add(owner, ownership_ref)
}

pub fn same_location_id(location_id_1: Option<Pubkey>, location_id_2: Option<Pubkey>) -> bool {
    match (location_id_1, location_id_2) {
        (Some(l1), Some(l2)) => l1 == l2,
        _ => false,
    }
}

pub fn fake_rng(key: Pubkey) -> u8 {
    let bytes = &key.to_bytes();
    let mut hasher = DefaultHasher::new();
    bytes.hash(&mut hasher);
    (hasher.finish() % 256) as u8
}

fn le(num: i64) -> [u8; 8] {
    let arr = num.to_le_bytes();

    msg!("num: {}", &num);
    arr.iter().for_each(|i| msg!("> i: {}", i));

    arr
}

#[derive(Accounts)]
#[instruction(name: String, position: [u8; 2], x: i64, y: i64, capacity: i64)]
pub struct InitLocation<'info> {
    #[account(
        init, 
        payer = owner, 
        space = Location::LEN,
        seeds = [
            b"map-location", 
            owner.key().as_ref(),
            &position,
            &le(x),
            &le(y),
        ],
        bump,
    )]
    pub location: Account<'info, Location>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Stuff<'info> {
    #[account(init, payer = owner, space = Location::LEN)]
    pub location: Account<'info, Location>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}
