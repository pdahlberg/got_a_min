import * as anchor from "@project-serum/anchor";
//import { PublicKey, Keypair } from "@solana/web3.js";
import { assert, expect } from 'chai';
import { assertion, promise } from 'chai-as-promised';
import { AnchorError, Program } from "@project-serum/anchor";
import { GotAMin } from "../target/types/got_a_min";
import { publicKey } from "@project-serum/anchor/dist/cjs/utils";

type KP = anchor.web3.Keypair;

describe("got_a_min", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.GotAMin as Program<GotAMin>;
  const programProvider = program.provider as anchor.AnchorProvider;

  it("Init resource", async () => {
    const resource = anchor.web3.Keypair.generate();

    let result = await initResource(program, resource, "A", []);
    
    expect(result.owner.toBase58()).to.equal(programProvider.wallet.publicKey.toBase58());
    expect(result.amount.toNumber()).to.equal(0);
  });

  it("Init resource with input", async () => {
    const resource = anchor.web3.Keypair.generate();
    let [resourceA, _] = await createResource(program, "A", []);

    let result = await initResource(program, resource, "B", [[resourceA as KP, 1]]);
    
    expect(result.owner.toBase58()).to.equal(programProvider.wallet.publicKey.toBase58());
    expect(result.amount.toNumber()).to.equal(0);
  });

  it("Init producer", async () => {
    const producer = anchor.web3.Keypair.generate();
    const resource = anchor.web3.Keypair.generate();
    await initResource(program, resource, "A", []);

    let result = await initProducer(program, producer, resource, 1);
    
    expect(result.owner.toBase58()).to.equal(programProvider.wallet.publicKey.toBase58());
    expect(result.productionRate.toNumber()).to.equal(1);
    expect(result.resourceId.toBase58()).to.equal(resource.publicKey.toBase58());
  });

  it("Produce 1 of resource A", async () => {
    let [resource, _] = await createResource(program, 'A', []);
    let [producer, __] = await createProducer(program, resource, 1);

    let result = await produce_without_input(program, producer, resource);

    expect(result.name).to.equal('A');
    expect(result.amount.toNumber()).to.equal(1);
  });

  it("Produce 2 of resource B", async () => {
    let [resource, _] = await createResource(program, 'B', []);
    let [producer, __] = await createProducer(program, resource, 2);

    let result = await produce_without_input(program, producer, resource);

    expect(result.name).to.equal('B');
    expect(result.amount.toNumber()).to.equal(2);
  });

  it("Produce resource B with input A fails when A is empty", async () => {
    let [resourceA, _1] = await createResource(program, 'A', []);
    let [resourceB, _3] = await createResource(program, 'B', [[resourceA, 1]]);
    let [producerB, _4] = await createProducer(program, resourceB, 2);

    // await expect(stuff(program, producerB, resourceB, resourceA)).should.be.rejectedWith("I AM THE EXPECTED ERROR");
    try {
      await produce_with_1_input(program, producerB, resourceB, resourceA);
      
      assert(false, "Expected to fail");
    } catch(e) {
      assertAnchorError(e, "InputResourceAmountTooLow");
    }

  });

  it("Produce 1 resource B from 2 A", async () => {
    let [resourceA, _1] = await createResource(program, 'A', []) as [KP, any];
    let [producerA, _2] = await createProducer(program, resourceA, 2);
    let [resourceB, _3] = await createResource(program, 'B', [[resourceA, 2]]);
    let [producerB, _4] = await createProducer(program, resourceB, 1);
    await produce_without_input(program, producerA, resourceA);

    let result = await produce_with_1_input(program, producerB, resourceB, resourceA);
    let inputResult = await program.account.resource.fetch(resourceA.publicKey);

    expect(result.name).to.equal('B');
    expect(result.amount.toNumber()).to.equal(1);
    expect(inputResult.amount.toNumber()).to.equal(0);    
  });

  it("Produce 1 resource C from 1 A + 1 B", async () => {
    let [resourceA, _1] = await createResource(program, 'A', []) as [KP, any];
    let [producerA, _2] = await createProducer(program, resourceA, 1);
    let [resourceB, _3] = await createResource(program, 'B', []) as [KP, any];
    let [producerB, _4] = await createProducer(program, resourceB, 1);
    let [resourceC, _5] = await createResource(program, 'C', [[resourceA, 1], [resourceB, 1]]);
    let [producerC, _6] = await createProducer(program, resourceC, 1);
    await produce_without_input(program, producerA, resourceA);
    await produce_without_input(program, producerB, resourceB);

    let result = await produce_with_2_inputs(program, producerC, resourceC, resourceA, resourceB);
    let inputAResult = await program.account.resource.fetch(resourceA.publicKey);
    let inputBResult = await program.account.resource.fetch(resourceB.publicKey);

    expect(result.name).to.equal('C');
    expect(result.amount.toNumber(), "Resource C should be produced").to.equal(1);
    expect(inputAResult.amount.toNumber(), "Input A should be consumed").to.equal(0);    
    expect(inputBResult.amount.toNumber(), "Input B should be consumed").to.equal(0);
  });

});

function assertAnchorError(error: any, errorName: String) {
  expect(error).to.be.instanceOf(AnchorError);
  let anchorError: AnchorError = error;
  expect(anchorError.error.errorCode.code).to.equal(errorName);
}

async function createResource(program: Program<GotAMin>, name: string, inputs) {
  const resource: anchor.web3.Keypair = anchor.web3.Keypair.generate();
  return [resource, await initResource(program, resource, name, inputs)];
}

async function initResource(program: Program<GotAMin>, resource, name: string, inputs: [anchor.web3.Keypair, Number][]) {
  const programProvider = program.provider as anchor.AnchorProvider;

  let publicKeyInputs = [];
  let amountInputs = [];
  inputs.forEach(tuple => {
    publicKeyInputs.push(tuple[0].publicKey);
    amountInputs.push(new anchor.BN(tuple[1].toFixed()));
  });

  await program.methods
    .initResource(name, publicKeyInputs, amountInputs)
    .accounts({
      resource: resource.publicKey,
      owner: programProvider.wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers(resource)
    .rpc();
    
  return await program.account.resource.fetch(resource.publicKey);
}

async function createProducer(program: Program<GotAMin>, resource, productionRate) {
  const producer = anchor.web3.Keypair.generate();
  return [producer, await initProducer(program, producer, resource, productionRate)];
}

async function initProducer(program: Program<GotAMin>, producer, resource, productionRate) {
  const programProvider = program.provider as anchor.AnchorProvider;

  await program.methods
    .initProducer(resource.publicKey, new anchor.BN(productionRate))
    .accounts({
      producer: producer.publicKey,
      owner: programProvider.wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers(producer)
    .rpc();
    
    return await program.account.producer.fetch(producer.publicKey);
}

async function produce_without_input(program: Program<GotAMin>, producer, resource, inputResources = []) {
  const programProvider = program.provider as anchor.AnchorProvider;

  await program.methods
    .produce()
    .accounts({
      producer: producer.publicKey,
      resource: resource.publicKey,
    })
    .rpc();

  return await program.account.resource.fetch(resource.publicKey);
}

async function produce_with_1_input(program: Program<GotAMin>, producer, resourceToProduce, resourceInput) {
  const programProvider = program.provider as anchor.AnchorProvider;

  await program.methods
    .produceWithOneInput()
    .accounts({
      producer: producer.publicKey,
      resourceToProduce: resourceToProduce.publicKey,
      resourceInput: resourceInput.publicKey,      
    })
    .rpc();

  return await program.account.resource.fetch(resourceToProduce.publicKey);
}

async function produce_with_2_inputs(program: Program<GotAMin>, producer, resourceToProduce, resourceInput1, resourceInput2) {
  const programProvider = program.provider as anchor.AnchorProvider;

  await program.methods
    .produceWithTwoInputs()
    .accounts({
      producer: producer.publicKey,
      resourceToProduce: resourceToProduce.publicKey,
      resourceInput1: resourceInput1.publicKey,
      resourceInput2: resourceInput2.publicKey,
    })
    .rpc();

  return await program.account.resource.fetch(resourceToProduce.publicKey);
}
