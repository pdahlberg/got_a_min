use anchor_lang::prelude::*;

use crate::errors::ValidationError;

#[account]
pub struct Location {
    pub owner: Pubkey,
    pub occupied_space: i64,
    pub capacity: i64,
    pub name: String,
    pub position: i64,
}

impl Location {
    pub const LEN: usize = DISCRIMINATOR_LENGTH
        + PUBLIC_KEY_LENGTH  // owner
        + OCCUPIED_SPACE_LENGTH
        + CAPACITY_LENGTH
        + NAME_LENGTH
        + POSITION_LENGTH
    ;

    pub fn add(&mut self, size: i64) -> Result<()> {
        self.occupied_space += size;
        require!(self.occupied_space <= self.capacity, ValidationError::LocationFull);
        Ok(())    
    }

    pub fn remove(&mut self, size: i64) -> Result<()> {
        self.occupied_space -= size;
        require!(self.occupied_space >= 0, ValidationError::ExperimentalError);
        Ok(())    
    }
}

pub trait InLocation {
    fn size(&self) -> i64 {
        1
    }
}

const CAPACITY_LENGTH: usize = 8;
const DISCRIMINATOR_LENGTH: usize = 8;
pub const NAME_LENGTH: usize = 64 * 4;
const OCCUPIED_SPACE_LENGTH: usize = 8;
const POSITION_LENGTH: usize = 8;
const PUBLIC_KEY_LENGTH: usize = 32;
