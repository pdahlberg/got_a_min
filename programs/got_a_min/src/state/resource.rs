use anchor_lang::prelude::*;

#[account]
pub struct Resource {
    pub owner: Pubkey,
    pub name: String,
    pub input: Vec<Pubkey>,
    pub input_amount: Vec<i64>,
}

impl Resource {
    pub const LEN: usize = DISCRIMINATOR_LENGTH
        + PUBLIC_KEY_LENGTH
        + NAME_LENGTH 
        + INPUT_LENGTH
        + INPUT_AMOUNT_LENGTH;          
}

const DISCRIMINATOR_LENGTH: usize = 8;
const INPUT_AMOUNT_LENGTH: usize = 8 * INPUT_MAX_SIZE;
const INPUT_LENGTH: usize = PUBLIC_KEY_LENGTH * INPUT_MAX_SIZE;
pub const INPUT_MAX_SIZE: usize = 2;
const NAME_LENGTH: usize = 16 * 4;
const PUBLIC_KEY_LENGTH: usize = 32;
