use anchor_lang::prelude::*;
use crate::state::location::*;
use crate::errors::ValidationError;

pub fn init(ctx: Context<InitLocation>, name: String, position: [u8; 2], capacity: i64) -> Result<()> {
    let location: &mut Account<Location> = &mut ctx.accounts.location;
    let owner: &Signer = &ctx.accounts.owner;

    location.owner = *owner.key;
    location.name = name;
    location.pos_x = position[0];
    location.pos_y = position[1];
    location.occupied_space = 0;
    location.capacity = capacity;
    location.occupied_by = vec!();
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

#[derive(Accounts)]
#[instruction(name: String, position: [u8; 2], capacity: i64)]
pub struct InitLocation<'info> {
    #[account(
        init, 
        payer = owner, 
        space = Location::LEN,
        seeds = [
            b"map-location", 
            owner.key().as_ref(),
            &position,
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
