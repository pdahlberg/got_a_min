use anchor_lang::prelude::*;
use instructions::*;

pub mod errors;
pub mod state;
pub mod instructions;

declare_id!("5kdCwKP8D1ciS9xyc3zRp1PaUcyD2yiBFkgBr8u3jn3K");

#[program]
pub mod got_a_min {
    use super::*;

    pub fn init_resource(ctx: Context<InitResource>, name: String, inputs: Vec<Pubkey>, input_amounts: Vec<i64>) -> Result<()> {
        resource::init_resource(ctx, name, inputs, input_amounts)
    }

    pub fn init_producer(ctx: Context<InitProducer>, resource_id: Pubkey, production_rate: i64, production_time: i64) -> Result<()> {
        producer::init_producer(ctx, resource_id, production_rate, production_time)
    }

    pub fn init_storage(ctx: Context<InitStorage>, resource_id: Pubkey, capacity: i64) -> Result<()> {
        storage::init_storage(ctx, resource_id, capacity)
    }

    pub fn produce_without_input(ctx: Context<ProduceResource>) -> Result<()> {
        producer::produce_without_input(ctx)
    }

    pub fn produce_with_one_input(ctx: Context<ProduceResourceWith1Input>) -> Result<()> {
        producer::produce_with_one_input(ctx)
        //Ok(())
    }

    pub fn produce_with_two_inputs(ctx: Context<ProduceResourceWith2Inputs>) -> Result<()> {
        producer::produce_with_two_inputs(ctx)
    }
}



