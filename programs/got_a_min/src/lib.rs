use anchor_lang::prelude::*;

declare_id!("5kdCwKP8D1ciS9xyc3zRp1PaUcyD2yiBFkgBr8u3jn3K");

#[error_code]
pub enum ErrorCode2 {
    #[msg("This error is just for fun.")]
    ErrorForFun,
}

#[program]
pub mod got_a_min {
    use super::*;

    pub fn init(ctx: Context<InitResource>) -> Result<()> {
        let resource: &mut Account<Resource> = &mut ctx.accounts.resource;
        let owner: &Signer = &ctx.accounts.owner;

        resource.owner = *owner.key;
        resource.amount = 0;

        Ok(())
    }

    pub fn produce(ctx: Context<ProduceResource>) -> Result<()> {
        let resource: &mut Account<Resource> = &mut ctx.accounts.resource;

        resource.amount += 1;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitResource<'info> {
    #[account(init, payer = owner, space = Resource::LEN)]
    pub resource: Account<'info, Resource>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ProduceResource<'info> {
    #[account(mut)]
    pub resource: Account<'info, Resource>,
    pub owner: Signer<'info>,
}

#[account]
pub struct Resource {
    pub owner: Pubkey,
    pub amount: i64,
}

const DISCRIMINATOR_LENGTH: usize = 8;
const OWNER_LENGTH: usize = 32;
const AMOUNT_LENGTH: usize = 8;

impl Resource {
    const LEN: usize = DISCRIMINATOR_LENGTH
        + OWNER_LENGTH
        + AMOUNT_LENGTH;
}
