import * as anchor from "@project-serum/anchor";
import chai from 'chai';
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

    let result = await initResource(program, resource, "A");
    
    expect(result.owner.toBase58()).to.equal(programProvider.wallet.publicKey.toBase58());
    expect(result.amount.toNumber()).to.equal(0);
  });

  it("Init producer", async () => {
    const producer = anchor.web3.Keypair.generate();
    const resource = anchor.web3.Keypair.generate();
    await initResource(program, resource, "A");

    let result = await initProducer(program, producer, resource);
    
    expect(result.owner.toBase58()).to.equal(programProvider.wallet.publicKey.toBase58());
    expect(result.productionRate.toNumber()).to.equal(1);
    expect(result.resourceId.toBase58()).to.equal(resource.publicKey.toBase58());
  });

  it("Produce 1 of resource A", async () => {
    const resource = anchor.web3.Keypair.generate();
    await initResource(program, resource, 'A');

    let result = await produce(program, resource);

    expect(result.amount.toNumber()).to.equal(1);
    expect(result.name).to.equal('A');
  });

  it("Produce 1 of resource B", async () => {
    const resource = anchor.web3.Keypair.generate();
    await initResource(program, resource, 'B');

    let result = await produce(program, resource);

    expect(result.amount.toNumber()).to.equal(1);
    expect(result.name).to.equal('B');
  });

});

async function initResource(program: Program<GotAMin>, resource, name: string) {
  const programProvider = program.provider as anchor.AnchorProvider;

  await program.methods
    .initResource(name)
    .accounts({
      resource: resource.publicKey,
      owner: programProvider.wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers(resource)
    .rpc();
    
    return await program.account.resource.fetch(resource.publicKey);
}

async function initProducer(program: Program<GotAMin>, producer, resource) {
  const programProvider = program.provider as anchor.AnchorProvider;

  await program.methods
    .initProducer(resource.publicKey)
    .accounts({
      producer: producer.publicKey,
      owner: programProvider.wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers(producer)
    .rpc();
    
    return await program.account.producer.fetch(producer.publicKey);
}

async function produce(program: Program<GotAMin>, resource) {
  const programProvider = program.provider as anchor.AnchorProvider;

  await program.methods
    .produce()
    .accounts({
      resource: resource.publicKey,
    })
    .rpc();

  return await program.account.resource.fetch(resource.publicKey);
}
