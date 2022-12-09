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
const AWAITING_UNITS_LENGTH: usize = 8;
const CAPACITY_LENGTH: usize = 8;
const CLAIMED_AT_LENGTH: usize = 8;
const DISCRIMINATOR_LENGTH: usize = 8;
const INPUT_AMOUNT_LENGTH: usize = 8 * INPUT_MAX_SIZE;
const INPUT_LENGTH: usize = PUBLIC_KEY_LENGTH * INPUT_MAX_SIZE;
const INPUT_MAX_SIZE: usize = 2;
const NAME_LENGTH: usize = 16 * 4;
const PRODUCTION_RATE_LENGTH: usize = 8;
const PRODUCTION_TIME_LENGTH: usize = 8;
const PUBLIC_KEY_LENGTH: usize = 32;
