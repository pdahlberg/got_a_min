use anchor_lang::prelude::*;
use crate::state::stuff::*;


pub fn init(ctx: Context<InitStuff>, x: i64) -> Result<()> {
    let stuff: &mut Account<Stuff> = &mut ctx.accounts.stuff;
    
    stuff.number = 7;
    stuff.x = x;
    stuff.bump = *ctx.bumps.get("stuff").unwrap();
    //msg!("num: {}", num);
    //num.to_le_bytes().iter().for_each(|i| msg!("i: {}", i));

    msg!("Init stuff works!");

    Ok(())
}

#[derive(Accounts)]
pub struct InitStuff<'info> {
    #[account(
        init, 
        payer = owner, 
        space = Stuff::LEN,
        seeds = [
            b"stuff", 
            owner.key().as_ref(),
        ],
        bump,
    )]
    pub stuff: Account<'info, Stuff>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/*pub fn update(ctx: Context<UpdateStuff>, number: u8) -> Result<()> {
    let stuff: &mut Account<Stuff> = &mut ctx.accounts.stuff;

    //stuff.number = number;

    //require!(stuff.number <= 1234, ValidationError::ExperimentalError);

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateStuff<'info> {
    #[account(mut)]
    pub stuff: Account<'info, Stuff>,
}*/
