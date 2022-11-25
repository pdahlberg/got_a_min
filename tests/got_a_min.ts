import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { GotAMin } from "../target/types/got_a_min";

describe("got_a_min", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.GotAMin as Program<GotAMin>;

  it("Produce with error", async () => {
    // Add your test here.
    const tx1 = await program.methods.produce().rpc();
    console.log("Your transaction signature", tx1);

    /*const tx2 = await program.methods.produce().rpc();
    console.log("Your transaction signature", tx2);

    const tx3 = await program.methods.produce().rpc();
    console.log("Your transaction signature", tx3);
    */
  });
});
