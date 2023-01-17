use anchor_lang::prelude::*;

#[account]
pub struct Producer {
    pub owner: Pubkey,
    pub resource_id: Pubkey,
    pub location_id: Pubkey,
    pub output_rate: i64,   // Produce this many units per [output_time]. 
    pub output_time: i64,   // Seconds
    pub awaiting_units: i64,    // This amount can be claimed after waiting [output_time] * [awaiting_units] seconds.
    pub claimed_at: i64,
}

impl Producer {
    pub const LEN: usize = DISCRIMINATOR_LENGTH
        + PUBLIC_KEY_LENGTH  // owner
        + PUBLIC_KEY_LENGTH  // resource_id
        + PUBLIC_KEY_LENGTH  // location_id
        + OUTPUT_RATE_LENGTH
        + OUTPUT_TIME_LENGTH
        + AWAITING_UNITS_LENGTH
        + CLAIMED_AT_LENGTH;
        
    pub fn size(&self) -> i64 {
        1
    }
}

const AWAITING_UNITS_LENGTH: usize = 8;
const CLAIMED_AT_LENGTH: usize = 8;
const DISCRIMINATOR_LENGTH: usize = 8;
const OUTPUT_RATE_LENGTH: usize = 8;
const OUTPUT_TIME_LENGTH: usize = 8;
const PUBLIC_KEY_LENGTH: usize = 32;
