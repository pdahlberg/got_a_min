use anchor_lang::prelude::*;

#[account]
pub struct Location {
    pub owner: Pubkey,
    pub capacity: i64,
    pub name: String,
    pub position: i64,
}

impl Location {
    pub const LEN: usize = DISCRIMINATOR_LENGTH
        + PUBLIC_KEY_LENGTH  // owner
        + CAPACITY_LENGTH
        + NAME_LENGTH
        + POSITION_LENGTH;
}

const CAPACITY_LENGTH: usize = 8;
const DISCRIMINATOR_LENGTH: usize = 8;
pub const NAME_LENGTH: usize = 64 * 4;
const POSITION_LENGTH: usize = 8;
const PUBLIC_KEY_LENGTH: usize = 32;