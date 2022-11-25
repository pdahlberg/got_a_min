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

  it("Produce one", async () => {
    const resource = anchor.web3.Keypair.generate();

    await program.methods
      .produce()
      .accounts({
        resource: resource.publicKey,
        owner: programProvider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([resource])
      .rpc();

    let result = await program.account.resource.fetch(resource.publicKey);
    
    expect(result.amount.toNumber()).to.equal(1);
  });

});
