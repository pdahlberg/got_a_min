import * as anchor from "@project-serum/anchor";
//import { PublicKey, Keypair } from "@solana/web3.js";
import { expect } from 'chai';
import { Program } from "@project-serum/anchor";
import { GotAMin } from "../target/types/got_a_min";

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

    let result = await initResource(program, resource, "B", [resourceA]);
    
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

    let result = await produce(program, producer, resource);

    expect(result.name).to.equal('A');
    expect(result.amount.toNumber()).to.equal(1);
  });

  it("Produce 2 of resource B", async () => {
    let [resource, _] = await createResource(program, 'B', []);
    let [producer, __] = await createProducer(program, resource, 2);

    let result = await produce(program, producer, resource);

    expect(result.name).to.equal('B');
    expect(result.amount.toNumber()).to.equal(2);
  });

  it("Produce resource B with input A fails when A is empty", async () => {
    let [resourceA, _] = await createResource(program, 'A', []);
    let [producerA, __] = await createProducer(program, resourceA, 1);
    let [resourceB, ___] = await createResource(program, 'B', [resourceA]);
    let [producerB, ____] = await createProducer(program, resourceB, 2);

    let result = await stuff(program, producerB, resourceB, resourceA);

    expect(result.name).to.equal('B');
    expect(result.amount.toNumber()).to.equal(0);
    let resResult = await program.account.resource.fetch(resourceA.publicKey);
    expect(resResult.amount.toNumber()).to.equal(0);    
  });

});

async function createResource(program: Program<GotAMin>, name: string, inputs) {
  const resource = anchor.web3.Keypair.generate();
  return [resource, await initResource(program, resource, name, inputs)];
}

async function initResource(program: Program<GotAMin>, resource, name: string, inputs: anchor.web3.Keypair[]) {
  const programProvider = program.provider as anchor.AnchorProvider;

  let publicKeyInputs = inputs.map(kp => kp.publicKey);

  await program.methods
    .initResource(name, publicKeyInputs)
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

async function produce(program: Program<GotAMin>, producer, resource, inputResources = []) {
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

async function stuff(program: Program<GotAMin>, producer, resource1, resource2) {
  const programProvider = program.provider as anchor.AnchorProvider;

  await program.methods
    .stuff()
    .accounts({
      producer: producer.publicKey,
      resource1: resource1.publicKey,
      resource2: resource2.publicKey,      
    })
    .rpc();

  return await program.account.resource.fetch(resource1.publicKey);
}
