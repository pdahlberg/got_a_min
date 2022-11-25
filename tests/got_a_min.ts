import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { GotAMin } from "../target/types/got_a_min";

describe("got_a_min", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.GotAMin as Program<GotAMin>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.produce().rpc();
    console.log("Your transaction signature", tx);
  });
});
