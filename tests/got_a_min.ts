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

    let result = await init(program, resource);
    
    expect(result.amount.toNumber()).to.equal(0);
    expect(result.owner.toBase58).to.equal(programProvider.wallet.publicKey.toBase58);
  });

  it("Produce 1", async () => {
    const resource = anchor.web3.Keypair.generate();
    await init(program, resource);

    let result = await produce(program, resource);

    expect(result.amount.toNumber()).to.equal(1);
  });

});

async function init(program: Program<GotAMin>, resource) {
  const programProvider = program.provider as anchor.AnchorProvider;

  await program.methods
    .init()
    .accounts({
      resource: resource.publicKey,
        owner: programProvider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers(resource)
    .rpc();
    
    return await program.account.resource.fetch(resource.publicKey);
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
