use anchor_lang::prelude::*;

#[account]
pub struct Unit {
    pub owner: Pubkey,
    pub at_location_id: Pubkey,
    pub name: String,
    pub movement_speed: i64,
    pub arrives_at: i64,
    //pub occupied_space: i64,
    //pub capacity: i64,
    //pub occupied_by: Vec<OwnershipRef>,
    pub bump: u8,
}

impl Unit {
    pub const LEN: usize = DISCRIMINATOR_LENGTH
        + PUBLIC_KEY_LENGTH  // owner
        + PUBLIC_KEY_LENGTH  // at_location_id
        + NAME_LENGTH
        + BUMP_LENGTH
    ;

    pub fn location_id(&self, current_time: i64) -> Option<Pubkey> {
        match self.arrives_at {
            0 => Some(self.at_location_id),
            timestamp => {
                match current_time >= timestamp {
                    true => Some(self.at_location_id),
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

const DISCRIMINATOR_LENGTH: usize = 8;
pub const NAME_LENGTH: usize = 8;
const PUBLIC_KEY_LENGTH: usize = 32;
const BUMP_LENGTH: usize = 1;
