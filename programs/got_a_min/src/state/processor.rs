use anchor_lang::prelude::*;

#[account]
pub struct Processor {
    pub owner: Pubkey,
    pub resource_id: Pubkey,
    pub location_id: Pubkey,
    pub output_rate: i64,   // Produce this many units per [processing_duration]. 
    pub processing_duration: i64,   // Solana time unit (usually 400-415ms)
    pub awaiting_units: i64,    // This amount can be claimed after waiting [processing_duration] * [awaiting_units] seconds.
    pub claimed_at: i64,
    pub processor_type: ProcessorType,
}

impl Processor {
    pub const LEN: usize = DISCRIMINATOR_LENGTH
        + PUBLIC_KEY_LENGTH  // owner
        + PUBLIC_KEY_LENGTH  // resource_id
        + PUBLIC_KEY_LENGTH  // location_id
        + OUTPUT_RATE_LENGTH
        + PROCESSING_DURATION_LENGTH
        + AWAITING_UNITS_LENGTH
        + CLAIMED_AT_LENGTH
        + PROCESSOR_TYPE_LENGTH;
        
    pub fn size(&self) -> i64 {
        1
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ProcessorType {
    Producer,
    Sender,
}

const AWAITING_UNITS_LENGTH: usize = 8;
const CLAIMED_AT_LENGTH: usize = 8;
const DISCRIMINATOR_LENGTH: usize = 8;
const OUTPUT_RATE_LENGTH: usize = 8;
const PROCESSING_DURATION_LENGTH: usize = 8;
const PROCESSOR_TYPE_LENGTH: usize = 1;
const PUBLIC_KEY_LENGTH: usize = 32;
