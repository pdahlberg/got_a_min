use anchor_lang::prelude::*;

use crate::errors::ValidationError;

#[account]
pub struct Map {
    pub owner: Pubkey,
    pub row_ptrs: [i64; ROW_PTR_MAX],
    pub columns: [i64; COL_MAX],
    pub values: [u8; COL_MAX],
}

impl Map {
    pub const LEN: usize = DISCRIMINATOR_LENGTH
        + PUBLIC_KEY_LENGTH  // owner
        + ROW_PTR_LENGTH
        + COL_LENGTH
        + VAL_LENGTH
    ;


}

const DISCRIMINATOR_LENGTH: usize = 8;
pub const ROW_PTR_MAX: usize = 10;
const ROW_PTR_LENGTH: usize = 8 * ROW_PTR_MAX;
pub const COL_MAX: usize = 20;
const COL_LENGTH: usize = 8 * COL_MAX;
const VAL_LENGTH: usize = 1 * COL_MAX;
const PUBLIC_KEY_LENGTH: usize = 32;
