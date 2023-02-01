use anchor_lang::prelude::*;

use crate::state::{map::*, Map};
use crate::instructions::location;
use crate::errors::ValidationError;

#[derive(Accounts)]
pub struct InitMap<'info> {
    #[account(init, payer = owner, space = Map::LEN)]
    pub map: Account<'info, Map>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn init(ctx: Context<InitMap>) -> Result<()> {
    let map: &mut Account<Map> = &mut ctx.accounts.map;
    let owner: &Signer = &ctx.accounts.owner;

    map.owner = owner.key();

    Ok(())
}

