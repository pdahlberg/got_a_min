use anchor_lang::prelude::*;

use crate::{errors::ValidationError, instructions::location::fake_rng};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct OwnershipRef {
    pub item: Pubkey,
    pub player: Pubkey
}

#[account]
pub struct Location {
    pub owner: Pubkey,
    pub occupied_space: i64,
    pub capacity: i64,
    pub name: String,
    pub pos_x: u8,
    pub pos_y: u8,
    pub occupied_by: Vec<OwnershipRef>,
    pub location_type: LocationType,
    pub bump: u8,
}

impl Location {
    pub const LEN: usize = DISCRIMINATOR_LENGTH
        + PUBLIC_KEY_LENGTH  // owner
        + OCCUPIED_SPACE_LENGTH
        + CAPACITY_LENGTH
        + NAME_LENGTH
        + POS_X_LENGTH
        + POS_Y_LENGTH
        + OCCUPIED_BY_LENGTH
        + LOCATION_TYPE_LENGTH
        + BUMP_LENGTH
    ;

    pub fn add(&mut self, owner: &Signer, ownership_ref: OwnershipRef) -> Result<()> {
        require!(ownership_ref.player == owner.key(), ValidationError::OwnerRequired);

        self.occupied_space += 1;
        self.occupied_by.push(ownership_ref);
        // verify that it only exists once in the list
        require!(self.occupied_space() <= self.capacity, ValidationError::LocationFull);
        Ok(())
    }

    pub fn remove(&mut self, owner: &Signer, ownership_ref: &OwnershipRef) -> Result<()> {
        require!(ownership_ref.player == owner.key(), ValidationError::OwnerRequired);

        self.occupied_space -= 1;
        match self.occupied_by.iter().position(|i| i.item == ownership_ref.item) {
            Some(index) => {
                self.occupied_by.remove(index);
                require!(self.occupied_space() >= 0, ValidationError::ExperimentalError);        
            },
            None => require!(false, ValidationError::ExperimentalError), // Custom error for not finding item
        }

        Ok(())    
    }

    pub fn occupied_space(&self) -> i64 {
        match i64::try_from(self.occupied_by.len()) {
            Ok(value) => value,
            Err(_) => MAX_CAPACITY_I64,
        }
    }

    pub fn distance(&self, other_location: &Location) -> i64 {
        let diff_x = match self.pos_x > other_location.pos_x {
            true => self.pos_x - other_location.pos_x,
            false => other_location.pos_x - self.pos_x,
        };
        let diff_y = match self.pos_y > other_location.pos_y {
            true => self.pos_y - other_location.pos_y,
            false => other_location.pos_y - self.pos_y,
        };
        //diff_x + diff_y
        1
    }

    pub fn explore(&mut self) {
        self.location_type = match fake_rng(self.owner) {
            0 => LocationType::Planet,
            1 => LocationType::Moon,
            2 => LocationType::Moon,
            3 => LocationType::Asteroid,
            4 => LocationType::Asteroid,
            5 => LocationType::Asteroid,
            _ => LocationType::Space,
        };
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum LocationType {
    Unexplored,
    Space,
    Planet,
    Moon,
    Asteroid,
}

pub trait InLocation {
    fn size(&self) -> i64 {
        1
    }
}

const MAX_CAPACITY: usize = 10;
const MAX_CAPACITY_I64: i64 = 10;

const CAPACITY_LENGTH: usize = 8;
const DISCRIMINATOR_LENGTH: usize = 8;
const LOCATION_TYPE_LENGTH: usize = 1;
pub const NAME_LENGTH: usize = 64 * 4;
const OCCUPIED_BY_LENGTH: usize = MAX_CAPACITY * (PUBLIC_KEY_LENGTH * 2);
const OCCUPIED_SPACE_LENGTH: usize = 8;
const POS_X_LENGTH: usize = 1;
const POS_Y_LENGTH: usize = 1;
const PUBLIC_KEY_LENGTH: usize = 32;
const BUMP_LENGTH: usize = 1;
