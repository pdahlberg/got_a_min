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
    map.row_ptrs = [0; ROW_PTR_MAX];
    map.columns = [0; COL_MAX];
    map.values = [0; COL_MAX];

    // RP => 0248
    map.row_ptrs[1] = 2;
    map.row_ptrs[2] = 4;
    map.row_ptrs[3] = 8;

    // C  => 2312012512345
    map.columns[0] = 2;
    map.columns[1] = 3;
    map.columns[2] = 1;
    map.columns[3] = 2;
    map.columns[4] = 0;
    map.columns[5] = 1;
    map.columns[6] = 2;
    map.columns[7] = 5;
    map.columns[8] = 1;
    map.columns[9] = 2;
    map.columns[10] = 3;
    map.columns[11] = 4;
    map.columns[12] = 5;

    // V  => 3121421351421
    map.values[0] = 3;
    map.values[1] = 1;
    map.values[2] = 2;
    map.values[3] = 1;
    map.values[4] = 4;
    map.values[5] = 2;
    map.values[6] = 1;
    map.values[7] = 3;
    map.values[8] = 5;
    map.values[9] = 1;
    map.values[10] = 4;
    map.values[11] = 2;
    map.values[12] = 1;

    Ok(())
}

#[derive(Accounts)]
pub struct MapPut<'info> {
    #[account(mut)]
    pub map: Account<'info, Map>,
}

pub fn put(ctx: Context<MapPut>, x: i64, y: i64, num: i64) -> Result<()> {
    Ok(())
}
