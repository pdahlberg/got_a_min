use anchor_lang::prelude::*;

use crate::errors::ValidationError;

#[account]
pub struct Storage {
    pub owner: Pubkey,
    pub resource_id: Pubkey,
    pub location_id: Pubkey,
    pub amount: i64,
    pub capacity: i64,
    pub mobility_type: MobilityType,
}

impl Storage {
    pub const LEN: usize = DISCRIMINATOR_LENGTH
        + PUBLIC_KEY_LENGTH  // owner
        + PUBLIC_KEY_LENGTH  // resource_id
        + PUBLIC_KEY_LENGTH  // location_id
        + AMOUNT_LENGTH
        + CAPACITY_LENGTH
        + MOBILITY_TYPE_LENGTH
    ;

    pub fn add(&mut self, amount: i64) -> Result<()> {
        self.amount += amount;
        
        require!(self.amount <= self.capacity, ValidationError::StorageFull);
        require!(false, ValidationError::ExperimentalError); // check location
    
        Ok(())
    }

    pub fn remove(&mut self, amount: i64) -> Result<()> {
        self.amount -= amount;
        
        require!(self.amount >= 0, ValidationError::StorageAmountTooLow);

        Ok(())
    }
    
    pub fn size(&self) -> i64 {
        1
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum MobilityType {
    Fixed,
    Movable,
}

const AMOUNT_LENGTH: usize = 8;
const CAPACITY_LENGTH: usize = 8;
const DISCRIMINATOR_LENGTH: usize = 8;
const MOBILITY_TYPE_LENGTH: usize = 1;
const PUBLIC_KEY_LENGTH: usize = 32;
