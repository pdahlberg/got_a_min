use std::hash::Hash;

use anchor_lang::prelude::*;

pub fn create_game_tile(ctx: Context<CreateGameTile>, xy: [u8; 2]) -> Result<()> {
    let game_tile = &mut ctx.accounts.game_tile;
    game_tile.x = xy[0];
    game_tile.y = xy[1];
    game_tile.name = "unknown".to_string();
    game_tile.bump = *ctx.bumps.get("game_tile").unwrap();

    msg!("something... ... .. .  .");

    Ok(())
}

fn fake_rng(key: Pubkey) -> u8 {
    let bytes = &key.to_bytes();
    let mut hasher = DefaultHasher::new();
    bytes.hash(&mut hasher);
    (hasher.finish() % 256) as u8
}

use std::hash::{Hasher};
use std::collections::hash_map::DefaultHasher;

use crate::errors::ValidationError;
use crate::state::{Location, Storage};


#[account]
pub struct GameTile {
    pub x: u8,
    pub y: u8,
    pub tile_type: u8,
    pub name: String,
    pub bump: u8,
}

/*fn pos_seed<'info>(param1: u8, param2: u8) -> &'info [u8] {
    let bytes = [param1, param2];
    &bytes
}*/

#[derive(Accounts)]
#[instruction(xy: [u8; 2])]
pub struct CreateGameTile<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init, 
        payer = owner, 
        space = 8 + 1 + 1 + 1 + (4 + 32) + 1,
        seeds = [
            b"game-tile", 
            owner.key().as_ref(),
            &xy,
        ],
        bump,
    )]
    pub game_tile: Account<'info, GameTile>,
    /*#[account(
        mut,
        seeds = [
            b"map-location", 
            owner.key().as_ref(),
            &xy,
        ],
        bump = location.bump,
    )]
    pub location: Account<'info, Location>,*/
    //#[account(mut)]
    //pub storage: Account<'info, Storage>,
    pub system_program: Program<'info, System>,
}

// Exploration ----------------------------------
pub fn explore_game_tile(ctx: Context<ExploreGameTile>, xy: [u8; 2]) -> Result<()> {
    let game_tile = &mut ctx.accounts.game_tile;

    require!(game_tile.tile_type == 0, ValidationError::ExperimentalError);

    let tile_type = fake_rng(game_tile.key());
    if tile_type % 28 == 0 {
        game_tile.name = "planet".to_string();
        game_tile.tile_type = 3;
    } else if tile_type % 5 == 0 {
        game_tile.name = "asteroid".to_string();
        game_tile.tile_type = 2;
    } else {
        game_tile.name = "space".to_string();
        game_tile.tile_type = 1;
    }
    
    Ok(())
}

#[derive(Accounts)]
#[instruction(xy: [u8; 2])]
pub struct ExploreGameTile<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [
            b"game-tile", 
            owner.key().as_ref(),
            &xy,
        ],
        bump = game_tile.bump,
    )]
    pub game_tile: Account<'info, GameTile>,
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
}
