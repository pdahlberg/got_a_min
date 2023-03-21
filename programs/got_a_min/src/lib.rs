use anchor_lang::prelude::*;
use instructions::*;
use crate::state::MobilityType;
use crate::state::ProcessorType;
use crate::state::FuelCostType;
use crate::state::LocationType;

pub mod errors;
pub mod state;
pub mod instructions;

// anchor test: declare_id!("5kdCwKP8D1ciS9xyc3zRp1PaUcyD2yiBFkgBr8u3jn3K");
// local: 
declare_id!("CbU9TfAS58V2JprRyMZ54hM48nMseTxth6FW6sCW79nM");

#[program]
pub mod got_a_min {
    use crate::state::FuelCostType;

    use super::*;

    pub fn create_game_tile(ctx: Context<CreateGameTile>, xy: [u8; 2]) -> Result<()> {
        game::create_game_tile(ctx, xy)
    }

    pub fn explore_game_tile(ctx: Context<ExploreGameTile>, xy: [u8; 2]) -> Result<()> {
        game::explore_game_tile(ctx, xy)
    }

    pub fn init_location(ctx: Context<InitLocation>, x: i64, y: i64, capacity: i64, location_type: LocationType) -> Result<()> {
        location::init(ctx, x, y, capacity, location_type)
    }

    pub fn init_processor(ctx: Context<InitProcessor>, processor_type: ProcessorType, fuel_resource_id: Pubkey, output_resource_id: Pubkey, output_rate: i64, processing_duration: i64, fuel_cost_type: FuelCostType) -> Result<()> {
        let current_timestamp = Clock::get()?.unix_timestamp;
        processor::init(ctx, processor_type, fuel_resource_id, output_resource_id, output_rate, processing_duration, fuel_cost_type, current_timestamp)
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
        x: i64,
        y: i64,
    ) -> Result<()> {
        storage::init(ctx, resource_id, capacity, mobility_type, movement_speed, x, y)
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
        let current_timestamp = Clock::get()?.unix_timestamp;
        storage::update_move_status(ctx, current_timestamp)
    }

    pub fn move_storage(ctx: Context<MoveStorage>) -> Result<()> {
        let current_timestamp = Clock::get()?.unix_timestamp;
        storage::move_to_location(ctx, current_timestamp)
    }

    pub fn produce_without_input(ctx: Context<ProcessesResource>) -> Result<()> {
        let current_timestamp = Clock::get()?.unix_timestamp;
        processor::claim_production(ctx, current_timestamp)
    }

    pub fn produce_with_one_input(ctx: Context<ProcessesResourceWith1Input>) -> Result<()> {
        let current_timestamp = Clock::get()?.unix_timestamp;
        processor::produce_with_one_input(ctx, current_timestamp)
    }

    pub fn produce_with_two_inputs(ctx: Context<ProcessesResourceWith2Inputs>) -> Result<()> {
        let current_timestamp = Clock::get()?.unix_timestamp;
        processor::produce_with_two_inputs(ctx, current_timestamp)
    }

    pub fn send(ctx: Context<SendResource>, send_amount: i64, from_x: i64, from_y: i64, to_x: i64, to_y: i64) -> Result<()> {
        let current_timestamp = Clock::get()?.unix_timestamp;
        processor::send(ctx, send_amount, current_timestamp, from_x, from_y, to_x, to_y)
    }

    pub fn init_unit(ctx: Context<InitUnit>, name: String, x: i64, y: i64) -> Result<()> {
        unit::init(ctx, name, x, y)
    }

    pub fn move_unit_start(ctx: Context<MoveUnitStart>, from_x: i64, from_y: i64, to_x: i64, to_y: i64, name: String) -> Result<()> {
        let current_timestamp = Clock::get()?.unix_timestamp;
        unit::move_unit_start(ctx, from_x, from_y, to_x, to_y, name, current_timestamp)
    }

    pub fn move_unit_complete(ctx: Context<MoveUnitComplete>, to_x: i64, to_y: i64, name: String) -> Result<()> {
        let current_timestamp = Clock::get()?.unix_timestamp;
        unit::move_unit_complete(ctx, to_x, to_y, name, current_timestamp)
    }

    pub fn init_map(ctx: Context<InitMap>, compressed_value: u8) -> Result<()> {
        map::init(ctx, compressed_value)
    }

    pub fn map_put(ctx: Context<MapPut>, x: u8, y: u8, num: u8) -> Result<()> {
        map::put(ctx, x, y, num)
    }

    // -- debug --
    pub fn debug_set_storage_amount(ctx: Context<DebugSetStorageAmount>, amount: i64) -> Result<()> {
        debug::set_storage_amount(ctx, amount)
    }

    pub fn debug_send(ctx: Context<SendResource>, send_amount: i64, current_timestamp: i64, from_x: i64, from_y: i64, to_x: i64, to_y: i64) -> Result<()> {
        processor::send(ctx, send_amount, current_timestamp, from_x, from_y, to_x, to_y)
    }

    pub fn debug_produce_without_input(ctx: Context<ProcessesResource>, current_timestamp: i64) -> Result<()> {
        processor::claim_production(ctx, current_timestamp)
    }

    pub fn debug_produce_with_one_input(ctx: Context<ProcessesResourceWith1Input>, current_timestamp: i64) -> Result<()> {
        processor::produce_with_one_input(ctx, current_timestamp)
    }

    pub fn debug_produce_with_two_inputs(ctx: Context<ProcessesResourceWith2Inputs>, current_timestamp: i64) -> Result<()> {
        processor::produce_with_two_inputs(ctx, current_timestamp)
    }

    pub fn debug_init_processor(ctx: Context<InitProcessor>, processor_type: ProcessorType, fuel_resource_id: Pubkey, output_resource_id: Pubkey, output_rate: i64, processing_duration: i64, fuel_cost_type: FuelCostType, current_timestamp: i64) -> Result<()> {
        processor::init(ctx, processor_type, fuel_resource_id, output_resource_id, output_rate, processing_duration, fuel_cost_type, current_timestamp)
    }

    pub fn debug_move_unit_start(ctx: Context<MoveUnitStart>, from_x: i64, from_y: i64, to_x: i64, to_y: i64, name: String, current_timestamp: i64) -> Result<()> {
        unit::move_unit_start(ctx, from_x, from_y, to_x, to_y, name, current_timestamp)
    }

    pub fn debug_move_unit_complete(ctx: Context<MoveUnitComplete>, to_x: i64, to_y: i64, name: String, current_timestamp: i64) -> Result<()> {
        unit::move_unit_complete(ctx, to_x, to_y, name, current_timestamp)
    }

    pub fn debug_update_storage_move_status(ctx: Context<UpdateStorageMoveStatus>, current_timestamp: i64) -> Result<()> {
        storage::update_move_status(ctx, current_timestamp)
    }

    pub fn debug_move_storage(ctx: Context<MoveStorage>, current_timestamp: i64) -> Result<()> {
        storage::move_to_location(ctx, current_timestamp)
    }

    pub fn debug_init_stuff(ctx: Context<InitStuff>, x: i64) -> Result<()> {
        stuff::init(ctx, x)
    }

}



