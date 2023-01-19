use anchor_lang::prelude::*;

pub fn create_game_tile(ctx: Context<CreateGameTile>, x: u8, y: u8, name: String) -> Result<()> {
    let game_tile = &mut ctx.accounts.game_tile;
    game_tile.x = x;
    game_tile.y = y;
    //game_tile.thing = "stone".to_string();
    // let key = format!("{x}:{y}");
    game_tile.bump = *ctx.bumps.get("game_tile").unwrap();
    Ok(())
}

#[account]
pub struct GameTile {
    pub x: u8,
    pub y: u8,
    pub name: String,
    pub bump: u8,
}

fn name_seed(name: &str) -> &[u8] {
    let b = name.as_bytes();
    if b.len() > 32 { &b[0..32] } else { b }
}

#[derive(Accounts)]
#[instruction(x: u8, y: u8, name: String)]
pub struct CreateGameTile<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init, 
        payer = owner, 
        space = 8 + 1 + 1 + (4 + name.len()) + 1,
        seeds = [
            b"game-tile", 
            owner.key().as_ref(),
            name_seed(&name),
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
