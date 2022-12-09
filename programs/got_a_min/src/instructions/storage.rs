use anchor_lang::prelude::*;
use crate::state::storage::*;


pub fn init_storage(ctx: Context<InitStorage>, resource_id: Pubkey, capacity: i64) -> Result<()> {
    let storage: &mut Account<Storage> = &mut ctx.accounts.storage;
    let owner: &Signer = &ctx.accounts.owner;

    storage.owner = *owner.key;
    storage.resource_id = resource_id;
    storage.amount = 0;
    storage.capacity = capacity;

    Ok(())
}

#[derive(Accounts)]
pub struct InitStorage<'info> {
    #[account(init, payer = owner, space = Storage::LEN)]
    pub storage: Account<'info, Storage>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}