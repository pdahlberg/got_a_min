use anchor_lang::prelude::*;

#[account]
pub struct Map {
    pub owner: Pubkey,
    pub row_ptrs: [u8; MAP_MAX_HEIGHT],
    pub columns: [u8; MAP_MAX_WIDTH],
    pub values: [u8; MAP_MAX_WIDTH],
    pub width: u8,
    pub height: u8,
    pub compressed_value: u8,
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

pub const MAP_MAX_HEIGHT: usize = 10;
pub const MAP_MAX_WIDTH: usize = 20;

const DISCRIMINATOR_LENGTH: usize = 8;
const ROW_PTR_LENGTH: usize = 1 * MAP_MAX_HEIGHT;
const COL_LENGTH: usize = 1 * (MAP_MAX_WIDTH * MAP_MAX_HEIGHT);
const VAL_LENGTH: usize = 1 * COL_LENGTH;
const PUBLIC_KEY_LENGTH: usize = 32;
const WIDTH_LENGTH: usize = 1;
const HEIGHT_LENGTH: usize = 1;
