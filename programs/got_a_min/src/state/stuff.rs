use anchor_lang::prelude::*;

#[account]
pub struct Stuff {
    pub number: u8,
    pub x: i64,
    pub bump: u8,
}

impl Stuff {
    pub const LEN: usize = DISCRIMINATOR_LENGTH + 1 + 8 + 1;
}

const DISCRIMINATOR_LENGTH: usize = 8;
