use anchor_lang::prelude::*;

#[account]
pub struct Location {
    pub owner: Pubkey,
    pub occupied: i64,
    pub capacity: i64,
    pub name: String,
    pub position: i64,
}

impl Location {
    pub const LEN: usize = DISCRIMINATOR_LENGTH
        + PUBLIC_KEY_LENGTH  // owner
        + OCCUPIED_LENGTH
        + CAPACITY_LENGTH
        + NAME_LENGTH
        + POSITION_LENGTH;
}

const CAPACITY_LENGTH: usize = 8;
const DISCRIMINATOR_LENGTH: usize = 8;
pub const NAME_LENGTH: usize = 64 * 4;
const OCCUPIED_LENGTH: usize = 8;
const POSITION_LENGTH: usize = 8;
const PUBLIC_KEY_LENGTH: usize = 32;
