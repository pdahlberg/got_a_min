use anchor_lang::prelude::*;

declare_id!("5kdCwKP8D1ciS9xyc3zRp1PaUcyD2yiBFkgBr8u3jn3K");

#[program]
pub mod got_a_min {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

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
