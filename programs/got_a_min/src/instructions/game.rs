use anchor_lang::prelude::*;

pub fn create_game_tile(ctx: Context<CreateGameTile>, xy: [u8; 2]) -> Result<()> {
    let game_tile = &mut ctx.accounts.game_tile;
    game_tile.x = xy[0];
    game_tile.y = xy[1];
    //game_tile.thing = "stone".to_string();
    // let key = format!("{x}:{y}");
    game_tile.bump = *ctx.bumps.get("game_tile").unwrap();
    Ok(())
}

#[account]
pub struct GameTile {
    pub x: u8,
    pub y: u8,
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
        space = 8 + 2 + 1,
        seeds = [
            b"game-tile", 
            owner.key().as_ref(),
            &xy,
        ],
        bump,
    )]
    pub game_tile: Account<'info, GameTile>,
    pub system_program: Program<'info, System>,
}

// Update ----------------------------------
pub fn update_game_tile(ctx: Context<UpdateGameTile>) -> Result<()> {
    let game_tile = &mut ctx.accounts.game_tile;

    game_tile.x = 5;
    //game_tile.thing = "grass".to_string();

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateGameTile<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"game-tile", owner.key().as_ref()],
        bump = game_tile.bump,
    )]
    pub game_tile: Account<'info, GameTile>,
}
