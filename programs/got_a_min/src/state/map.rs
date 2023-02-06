use anchor_lang::prelude::*;

#[account]
pub struct Map {
    pub owner: Pubkey,
    pub row_ptrs: [u8; ROW_PTR_MAX],
    pub columns: [u8; COL_MAX],
    pub values: [u8; COL_MAX],
    pub width: u8,
    pub height: u8,
}

impl Map {
    pub const LEN: usize = DISCRIMINATOR_LENGTH
        + PUBLIC_KEY_LENGTH  // owner
        + ROW_PTR_LENGTH
        + COL_LENGTH
        + VAL_LENGTH
        + WIDTH_LENGTH
        + HEIGHT_LENGTH
    ;


}

const DISCRIMINATOR_LENGTH: usize = 8;
pub const ROW_PTR_MAX: usize = 64;
const ROW_PTR_LENGTH: usize = 1 * ROW_PTR_MAX;
pub const COL_MAX: usize = 64;
const COL_LENGTH: usize = 1 * COL_MAX;
const VAL_LENGTH: usize = 1 * COL_MAX;
const PUBLIC_KEY_LENGTH: usize = 32;
const WIDTH_LENGTH: usize = 1;
const HEIGHT_LENGTH: usize = 1;
