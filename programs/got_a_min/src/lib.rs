use anchor_lang::prelude::*;
use instructions::*;
use crate::state::MobilityType;
use crate::state::ProcessorType;

pub mod errors;
pub mod state;
pub mod instructions;

// anchor test: declare_id!("5kdCwKP8D1ciS9xyc3zRp1PaUcyD2yiBFkgBr8u3jn3K");
// local: 
declare_id!("3113AWybUqHaSKaEmUXnUFwXu4EUp1VDpqQFCvY7oajN");

#[program]
pub mod got_a_min {
    use super::*;

    pub fn create_game_tile(ctx: Context<CreateGameTile>, xy: [u8; 2]) -> Result<()> {
        game::create_game_tile(ctx, xy)
    }

    pub fn explore_game_tile(ctx: Context<ExploreGameTile>, xy: [u8; 2]) -> Result<()> {
        game::explore_game_tile(ctx, xy)
    }

    pub fn init_location(ctx: Context<InitLocation>, name: String, position: [u8; 2], capacity: i64) -> Result<()> {
        location::init(ctx, name, position, capacity)
    }

    pub fn stuff(ctx: Context<InitStuff>) -> Result<()> {
        stuff::init(ctx)
    }

    pub fn update_stuff(ctx: Context<UpdateStuff>, number: i64) -> Result<()> {
        stuff::update(ctx, number)
    }

    pub fn init_processor(ctx: Context<InitProcessor>, processor_type: ProcessorType, resource_id: Pubkey, output_rate: i64, processing_duration: i64) -> Result<()> {
        processor::init(ctx, processor_type, resource_id, output_rate, processing_duration)
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
        position: [u8; 2],
    ) -> Result<()> {
        storage::init(ctx, resource_id, capacity, mobility_type, movement_speed, position)
    }

    pub fn simple_init_storage(
        ctx: Context<SimpleInitStorage>, xy: [u8; 2]) -> Result<()> {
        storage::simple_init(ctx, xy)
    }

    pub fn simple_test_storage(
        ctx: Context<SimpleTestStorage>, position: [u8; 2]) -> Result<()> {
        storage::simple_test(ctx, position)
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

    pub fn produce_without_input(ctx: Context<ProcessesResource>) -> Result<()> {
        processor::claim_production(ctx)
    }

    pub fn produce_with_one_input(ctx: Context<ProcessesResourceWith1Input>) -> Result<()> {
        processor::produce_with_one_input(ctx)
        //Ok(())
    }

    pub fn produce_with_two_inputs(ctx: Context<ProcessesResourceWith2Inputs>) -> Result<()> {
        processor::produce_with_two_inputs(ctx)
    }

    pub fn init_unit(ctx: Context<InitUnit>, name: String, position: [u8; 2]) -> Result<()> {
        unit::init(ctx, name, position)
    }

    pub fn move_unit(ctx: Context<MoveUnit>, from_pos: [u8; 2], to_pos: [u8; 2]) -> Result<()> {
        unit::move_unit(ctx, from_pos, to_pos)
    }
}



