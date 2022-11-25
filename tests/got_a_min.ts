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
    const player = anchor.web3.Keypair.generate();
    const resource = anchor.web3.Keypair.generate();

    const tx = await program.methods
      .produce()
      .accounts({
        resource: resource.publicKey,
        owner: programProvider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([resource])
      .rpc();
    console.log("Your transaction signature", tx);

    let result = await program.account.resource.fetch(resource.publicKey);
    expect(result.amount.toNumber()).to.equal(1);
  });

  /*it("Produce several", async () => {
    // Add your test here.
    const tx1 = await program.methods.produce().rpc();
    console.log("Your transaction signature", tx1);

    const tx2 = await program.methods.produce().rpc();
    console.log("Your transaction signature", tx2);
  });*/

  /*it("Produce several", async () => {
    await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(donator.publicKey, 10000000000),
        "confirmed"
      );

      const tx = await program.rpc.sendDonation(new anchor.BN(100), {
        accounts: {
            baseAccount: baseAccount.publicKey,
            user: donator.publicKey,
        },
        signers: [donator],
      });

      const balance = await program.account.baseAccount.getAccountInfo(donator.publicKey);
    console.log(balance);
      expect(balance.lamports.toString()).equal("100");
    });
  });*/

});
