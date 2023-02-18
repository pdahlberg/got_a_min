use anchor_lang::prelude::*;
use std::hash::{Hasher, Hash};
use std::collections::hash_map::DefaultHasher;
use crate::state::location::*;
use crate::errors::ValidationError;

pub fn init(ctx: Context<InitLocation>, name: String, x: i64, y: i64, capacity: i64, location_type: LocationType) -> Result<()> {
    let location: &mut Account<Location> = &mut ctx.accounts.location;
    let owner: &Signer = &ctx.accounts.owner;

    location.owner = *owner.key;
    location.name = name;
    location.pos_x = x;
    location.pos_y = y;
    location.occupied_space = 0;
    location.capacity = capacity;
    location.occupied_by = vec!();
    location.location_type = location_type;
    location.bump = *ctx.bumps.get("location").unwrap();

    require!(location.name.len() <= NAME_LENGTH, ValidationError::NameTooLong);

    msg!("Location {}x{} init", x, y);

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

#[derive(Accounts)]
#[instruction(name: String, x: i64, y: i64, capacity: i64)]
pub struct InitLocation<'info> {
    #[account(
        init, 
        payer = owner, 
        space = Location::LEN,
        seeds = [
            b"map-location", 
            owner.key().as_ref(),
            &x.to_le_bytes(),
            &y.to_le_bytes(),
        ],
        bump,
    )]
    pub location: Account<'info, Location>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}
