use anchor_lang::prelude::*;

use crate::errors::ValidationError;

#[account]
pub struct Unit {
    pub owner: Pubkey,
    pub at_location_id: Pubkey,
    pub name: String,
    pub movement_speed: i64,
    pub arrives_at: i64,
    //pub occupied_space: i64,
    //pub capacity: i64,
    //pub occupied_by: Vec<OwnershipRef>,
    pub bump: u8,
}

impl Unit {
    pub const LEN: usize = DISCRIMINATOR_LENGTH
        + PUBLIC_KEY_LENGTH  // owner
        + PUBLIC_KEY_LENGTH  // at_location_id
        + NAME_LENGTH
        + BUMP_LENGTH
    ;

}

const DISCRIMINATOR_LENGTH: usize = 8;
pub const NAME_LENGTH: usize = 64 * 4;
const PUBLIC_KEY_LENGTH: usize = 32;
const BUMP_LENGTH: usize = 1;
