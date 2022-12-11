use anchor_lang::prelude::*;

#[account]
pub struct Storage {
    pub owner: Pubkey,
    pub resource_id: Pubkey,
    pub amount: i64,
    pub capacity: i64,
}

impl Storage {
    pub const LEN: usize = DISCRIMINATOR_LENGTH
        + PUBLIC_KEY_LENGTH  // owner
        + PUBLIC_KEY_LENGTH  // resource_id
        + AMOUNT_LENGTH
        + CAPACITY_LENGTH;
}

const AMOUNT_LENGTH: usize = 8;
const CAPACITY_LENGTH: usize = 8;
const DISCRIMINATOR_LENGTH: usize = 8;
const PUBLIC_KEY_LENGTH: usize = 32;
