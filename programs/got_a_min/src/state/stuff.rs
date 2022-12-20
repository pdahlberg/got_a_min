use anchor_lang::prelude::*;

#[account]
pub struct Stuff {
    pub number: i64,
}

impl Stuff {
    pub const LEN: usize = DISCRIMINATOR_LENGTH
        + NUMBER_LENGTH
    ;

}

const DISCRIMINATOR_LENGTH: usize = 8;
const NUMBER_LENGTH: usize = 8;
