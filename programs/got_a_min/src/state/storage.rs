use anchor_lang::prelude::*;

use crate::errors::ValidationError;

use super::location;

#[account]
pub struct Storage {
    pub owner: Pubkey,
    pub resource_id: Pubkey,
    pub location_id: Pubkey,
    pub amount: i64,
    pub capacity: i64,
}

impl Storage {
    pub const LEN: usize = DISCRIMINATOR_LENGTH
        + PUBLIC_KEY_LENGTH  // owner
        + PUBLIC_KEY_LENGTH  // resource_id
        + PUBLIC_KEY_LENGTH  // location_id
        + AMOUNT_LENGTH
        + CAPACITY_LENGTH
    ;

    pub fn add(&mut self, amount: i64) -> Result<()> {
        self.amount += amount;
        
        require!(self.amount <= self.capacity, ValidationError::StorageFull);
    
        Ok(())
    }

    pub fn remove(&mut self, amount: i64) -> Result<()> {
        self.amount -= amount;
        
        require!(self.amount >= 0, ValidationError::StorageAmountTooLow);

        Ok(())
    }
        
}

impl location::InLocation for Storage {
    fn size(&self) -> i64 {
        1
    }
}

const AMOUNT_LENGTH: usize = 8;
const CAPACITY_LENGTH: usize = 8;
const DISCRIMINATOR_LENGTH: usize = 8;
const PUBLIC_KEY_LENGTH: usize = 32;
