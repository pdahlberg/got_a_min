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
    pub movement_speed: i64,
    pub arrives_at: i64,
}

impl Storage {
    pub const LEN: usize = DISCRIMINATOR_LENGTH
        + PUBLIC_KEY_LENGTH  // owner
        + PUBLIC_KEY_LENGTH  // resource_id
        + PUBLIC_KEY_LENGTH  // location_id
        + AMOUNT_LENGTH
        + CAPACITY_LENGTH
        + MOBILITY_TYPE_LENGTH
        + MOVEMENT_SPEED_LENGTH
        + ARRIVES_AT_LENGTH
    ;

    pub fn add(&mut self, amount: i64, from_location_id: Pubkey) -> Result<()> {
        self.amount += amount;
        
        require!(self.amount <= self.capacity, ValidationError::StorageFull);
        require!(self.location_id == from_location_id, ValidationError::DifferentLocations);
    
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

    pub fn location_id(&self, current_time: i64) -> Option<Pubkey> {
        match self.arrives_at {
            0 => Some(self.location_id),
            timestamp => {
                match current_time >= timestamp {
                    true => Some(self.location_id),
                    false => None,
                }
            },
        }
    }

    pub fn is_moving(&self, current_time: i64) -> bool {
        self.location_id(current_time).is_none()
    }

    pub fn has_arrived(&self, current_time: i64) -> bool {
        self.location_id(current_time).is_some() && self.arrives_at > 0
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum MobilityType {
    Fixed,
    Movable,
}

const AMOUNT_LENGTH: usize = 8;
const ARRIVES_AT_LENGTH: usize = 8;
const CAPACITY_LENGTH: usize = 8;
const DISCRIMINATOR_LENGTH: usize = 8;
const MOBILITY_TYPE_LENGTH: usize = 1;
const MOVEMENT_SPEED_LENGTH: usize = 8;
const PUBLIC_KEY_LENGTH: usize = 32;
