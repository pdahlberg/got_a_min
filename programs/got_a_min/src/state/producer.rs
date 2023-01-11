use anchor_lang::prelude::*;

#[account]
pub struct Producer {
    pub owner: Pubkey,
    pub resource_id: Pubkey,
    pub location_id: Pubkey,
    pub production_rate: i64,   // Produce this many units per [production_time]. 
    pub production_time: i64,   
    pub awaiting_units: i64,    // This amount can be claimed after waiting [production_time] * [awaiting_units] seconds.
    pub claimed_at: i64,
}

impl Producer {
    pub const LEN: usize = DISCRIMINATOR_LENGTH
        + PUBLIC_KEY_LENGTH  // owner
        + PUBLIC_KEY_LENGTH  // resource_id
        + PUBLIC_KEY_LENGTH  // location_id
        + PRODUCTION_RATE_LENGTH
        + PRODUCTION_TIME_LENGTH
        + AWAITING_UNITS_LENGTH
        + CLAIMED_AT_LENGTH;
        
    pub fn size(&self) -> i64 {
        1
    }
}

const AWAITING_UNITS_LENGTH: usize = 8;
const CLAIMED_AT_LENGTH: usize = 8;
const DISCRIMINATOR_LENGTH: usize = 8;
const PRODUCTION_RATE_LENGTH: usize = 8;
const PRODUCTION_TIME_LENGTH: usize = 8;
const PUBLIC_KEY_LENGTH: usize = 32;
