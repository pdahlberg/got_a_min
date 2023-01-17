use anchor_lang::prelude::*;
use instructions::*;
use crate::state::MobilityType;

pub mod errors;
pub mod state;
pub mod instructions;

// anchor test: declare_id!("5kdCwKP8D1ciS9xyc3zRp1PaUcyD2yiBFkgBr8u3jn3K");
// local: 
declare_id!("3113AWybUqHaSKaEmUXnUFwXu4EUp1VDpqQFCvY7oajN");

#[program]
pub mod got_a_min {
    use super::*;

    pub fn init_location(ctx: Context<InitLocation>, name: String, position: i64, capacity: i64) -> Result<()> {
        location::init(ctx, name, position, capacity)
    }

    pub fn stuff(ctx: Context<InitStuff>) -> Result<()> {
        stuff::init(ctx)
    }

    pub fn update_stuff(ctx: Context<UpdateStuff>, number: i64) -> Result<()> {
        stuff::update(ctx, number)
    }

    pub fn init_producer(ctx: Context<InitProducer>, resource_id: Pubkey, output_rate: i64, processing_duration: i64) -> Result<()> {
        producer::init(ctx, resource_id, output_rate, processing_duration)
    }

    pub fn init_resource(ctx: Context<InitResource>, name: String, inputs: Vec<Pubkey>, input_amounts: Vec<i64>) -> Result<()> {
        resource::init(ctx, name, inputs, input_amounts)
    }

    pub fn init_storage(
        ctx: Context<InitStorage>, 
        resource_id: Pubkey, 
        capacity: i64, 
        mobility_type: MobilityType,
        movement_speed: i64,
    ) -> Result<()> {
        storage::init(ctx, resource_id, capacity, mobility_type, movement_speed)
    }

    pub fn move_between_storage(ctx: Context<MoveBetweenStorage>, amount: i64) -> Result<()> {
        storage::move_between(ctx, amount)
    }

    pub fn update_storage_move_status(ctx: Context<UpdateStorageMoveStatus>) -> Result<()> {
        storage::update_move_status(ctx)
    }

    pub fn move_storage(ctx: Context<MoveStorage>) -> Result<()> {
        storage::move_to_location(ctx)
    }

    pub fn produce_without_input(ctx: Context<ProduceResource>) -> Result<()> {
        producer::claim_production(ctx)
    }

    pub fn produce_with_one_input(ctx: Context<ProduceResourceWith1Input>) -> Result<()> {
        producer::produce_with_one_input(ctx)
        //Ok(())
    }

    pub fn produce_with_two_inputs(ctx: Context<ProduceResourceWith2Inputs>) -> Result<()> {
        producer::produce_with_two_inputs(ctx)
    }
}



