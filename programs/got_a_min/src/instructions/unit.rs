use anchor_lang::prelude::*;
use crate::state::unit::*;
use crate::errors::ValidationError;

pub fn init(ctx: Context<InitUnit>, name: String) -> Result<()> {
    let unit: &mut Account<Unit> = &mut ctx.accounts.unit;
    let owner: &Signer = &ctx.accounts.owner;

    unit.owner = *owner.key;
    unit.name = name;
    unit.bump = *ctx.bumps.get("unit").unwrap();

    require!(unit.name.len() <= NAME_LENGTH, ValidationError::NameTooLong);

    Ok(())
}

fn string_to_seed(value: &str) -> &[u8] {
    let b = value.as_bytes();
    if b.len() > 32 { &b[0..32] } else { b }
}

#[derive(Accounts)]
//#[instruction(name: String)]
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
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}


