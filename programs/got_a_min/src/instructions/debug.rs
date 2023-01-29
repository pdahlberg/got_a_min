use anchor_lang::prelude::*;

use crate::state::{storage::*};

pub fn set_storage_amount(
    ctx: Context<DebugSetStorageAmount>,
    amount: i64,
) -> Result<()> {
    let storage: &mut Account<Storage> = &mut ctx.accounts.storage;
    storage.amount = amount;
    Ok(())
}

#[derive(Accounts)]
pub struct DebugSetStorageAmount<'info> {
    #[account(mut)]
    pub storage: Account<'info, Storage>,
}
