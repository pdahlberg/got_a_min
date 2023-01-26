import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { assert, expect } from 'chai';
import { assertion, promise } from 'chai-as-promised';
import { AccountClient, AnchorError, parseIdlErrors, Program } from "@coral-xyz/anchor";
import { GotAMin } from "../target/types/got_a_min";
import { publicKey } from "@coral-xyz/anchor/dist/cjs/utils";
import { SystemAccountsCoder } from "@coral-xyz/anchor/dist/cjs/coder/system/accounts";

type KP = anchor.web3.Keypair;

var DEFAULT_LOCATION: PublicKey;
type MobilityType = {fixed:{}} | {movable:{}};
type ProcessorType = {producer:{}} | {sender:{}};

before("Init", async () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.GotAMin as Program<GotAMin>;
  //const programProvider = program.provider as anchor.AnchorProvider;

  DEFAULT_LOCATION = await initDefaultLocation(program);
});

async function createGameTile(program, pk, x, y, ) {
  const provider = program.provider as anchor.AnchorProvider;
  let pos: [number, number] = [x, y];

  let gameTilePda = getMapTilePda(program, pk, x, y);
  let locationPda = getLocationPda(program, pk, pos);

  // Location test
  await initLocation2(program, 'name', pos, 5);
  
  const storage: KP = anchor.web3.Keypair.generate();
  await program.methods
    .simpleInitStorage(pos)
    .accounts({
      storage: storage.publicKey,
      location: locationPda,
      owner: pk,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([storage])
    .rpc();

  const gameTilePdaInfo = await provider.connection.getAccountInfo(gameTilePda);
  if(gameTilePdaInfo == null) {
    await program.methods
      .createGameTile(pos)
      .accounts({
        owner: pk,
        gameTile: gameTilePda,
        //location: locationPda,
        //storage: storage.publicKey,
      })
      //.signers([p1])
      .rpc();
  }

  return gameTilePda;
}

async function exploreGameTile(program, pk, x, y, map) {
  let pos: [number, number] = [x, y];

  let gameTilePda = getMapTilePda(program, pk, x, y);
  //let locationPda = getLocationPda(program, pk, pos);

  await program.methods
    .exploreGameTile(pos)
    .accounts({
      owner: pk,
      gameTile: gameTilePda,
      //location: locationPda,
    })
    .rpc();

  let updatedState = await fetchMapTileState(program, pk, x, y);
  map[y][x] = updatedState;
  return updatedState;
}

function getMapTilePda(program, pk, x, y) {
  let pos = [x, y];
  const [pda, _] = PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("game-tile"),
      pk.toBuffer(),
      new Uint8Array(pos),
    ],
    program.programId,
  );
  return pda;
}

function getLocationPda(program, pk, pos: [number, number]): PublicKey {
  let x = pos[0];
  let y = pos[1];
  return getPda(program, pk, "map-location", x, y);
}

function getPda(program, pk: PublicKey, key, x: number, y: number): PublicKey {
  let arrX = new Uint8Array(new anchor.BN(x).toArray('le', 8));
  let arrY = new Uint8Array(new anchor.BN(y).toArray('le', 8));

  const [pda, _] = PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode(key),
      pk.toBuffer(),
      arrX,
      arrY,
    ],
    program.programId,
  );
  return pda;
}

function getUnitPda(program, pk: PublicKey, name: string): PublicKey {
  const [pda, _] = PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("unit"),
      pk.toBuffer(),
      anchor.utils.bytes.utf8.encode(name),
    ],
    program.programId,
  );
  return pda;
}

async function fetchMapTileState(program, pk, x, y) {
  let pda = getMapTilePda(program, pk, x, y);
  return await program.account.gameTile.fetch(pda);
}

async function fetchLocationStatePK(program, pos: PublicKey) {
  return await program.account.location.fetch(pos);
}

async function fetchLocationState(program, pk, pos: [number, number]) {
  let pda = getLocationPda(program, pk, pos);
  return await fetchLocationStatePK(program, pda);
}

async function fetchStorageStatePK(program, pk) {
  return await program.account.storage.fetch(pk)
}

async function fetchUnitStatePK(program, unitPda: PublicKey) {
  return await program.account.unit.fetch(unitPda);
}

async function fetchUnitState(program, pk, name) {
  let pda = getUnitPda(program, pk, name);
  return await fetchUnitStatePK(program, pda);
}

function printMap(map, debug = false) {
  var debugStr = "";
  for(let y = 0; y < map.length; y++) {
    var row = "";
    for(let x = 0; x < map[y].length; x++) {
      if(map[y][x].tileType == 1) {
        row = row + " ";
      } else if(map[y][x].tileType == 3) {
        row = row + "*";
      } else if(map[y][x].tileType == 2) {
        row = row + ":";
      } else {
        row = row + "?";
      }

      if(debug) {
        debugStr = debugStr + "\n" + x + "/" + y + "=" + map[y][x].tileType + "(" + map[y][x].name + ")";
      }
    }
    console.log(row);
  }
  if(debug) {
    console.log(debugStr);
  }
}

describe("/Sandbox", () => {
  let provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.GotAMin as Program<GotAMin>;
  const programProvider = program.provider as anchor.AnchorProvider;

  it("pda-1", async () => {
    const p1: KP = anchor.web3.Keypair.generate();
    let pk = provider.wallet.publicKey;

    //await initDefaultLocation(program);
    
    let map = [];
    let maxColumns = 2;
    let maxRows = 2;

    for(let y = 0; y < maxRows; y++) {
      map[y] = [];
      for(let x = 0; x < maxColumns; x++) {
        console.log("Creating ", x, "/", y);
        await createGameTile(program, pk, x, y);
        //let loc = await fetchLocationState(program, pk, [x, y]);
        //console.log("Created loc: ", loc.capacity);
        let mapTile = await fetchMapTileState(program, pk, x, y);
        map[y][x] = mapTile;
      }
    }

    console.log("After create:");
    printMap(map);
    console.log("");

    let exploreX = 0;
    let exploreY = 0;
    let exploringPoses: Array<[number, number]> = [[2, 0], [3, 0], [1, 2], [3, 4]];
    for(var pos of exploringPoses) {
      if(pos[0] < maxColumns && pos[1] < maxRows) {
        await exploreGameTile(program, pk, pos[0], pos[1], map);
      }
    }

    console.log("After explore:");
    printMap(map);

    //failNotImplemented();
  });

  it("simple storage", async () => {
    let pk = provider.wallet.publicKey;
    let pos: [number, number] = [2, 1];

    await initLocation2(program, 'name', pos, 5);
    let locationState = await fetchLocationState(program, pk, pos);
    console.log(locationState);
    let locationPda = getLocationPda(program, pk, pos);
    
    const storage: KP = anchor.web3.Keypair.generate();
    await program.methods
      .simpleInitStorage(pos)
      .accounts({
        storage: storage.publicKey,
        location: locationPda,
        owner: pk,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([storage])
      .rpc();

    console.log("Init done... ");

    await program.methods
      .simpleTestStorage(pos)
      .accounts({
        storage: storage.publicKey,
        location: locationPda,
        owner: pk,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
  });

  /*it("test1", async () => {
    const p1: KP = anchor.web3.Keypair.generate();
    const p2: KP = anchor.web3.Keypair.generate();
    //let [resource, _1] = await createResource(program, 'A', []);
    //let [p1storage, _2] = await createStorageNew(program, p1, resource, 1);

    await program.methods
      .change()
      .accounts({
        location: DEFAULT_LOCATION.publicKey,
        storage: p1storage.publicKey,
        player: p1.publicKey,
      })
      .signers([
        p1,
      ])
      .rpc();*/

      /*await program.methods
      .change()
      .accounts({
        location: DEFAULT_LOCATION.publicKey,
        storage: p1storage.publicKey,
        player: p2.publicKey,
      })
      .signers([
        p2,
      ])
      .rpc();

    //let location = await program.account.location.fetch(DEFAULT_LOCATION.publicKey);

    //expect(location.occupiedSpace.toNumber()).equal(2)
    failNotImplemented();
  });*/
});

describe("/Unknown", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.GotAMin as Program<GotAMin>;
  const programProvider = program.provider as anchor.AnchorProvider;
  
});

describe("/Initializations", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.GotAMin as Program<GotAMin>;
  const provider = program.provider as anchor.AnchorProvider;

  it("Init resource", async () => {
    const resource = anchor.web3.Keypair.generate();

    let result = await initResource(program, resource, "A", []);
    
    expect(result.owner.toBase58()).to.equal(provider.wallet.publicKey.toBase58());
  });

  it("Init resource with input", async () => {
    const resource = anchor.web3.Keypair.generate();
    let [resourceA, _] = await createResource(program, "A", []);

    let result = await initResource(program, resource, "B", [[resourceA as KP, 1]]);
    
    expect(result.owner.toBase58()).to.equal(provider.wallet.publicKey.toBase58());
  });

  it("Init location", async () => {
    const programProvider = program.provider as anchor.AnchorProvider;
    let pk = programProvider.wallet.publicKey;
    let pos: [number, number] = [99, 99];
    let locationPda = await initLocation2(program, "loc", pos, 10);
    let state = await fetchLocationStatePK(program, locationPda);
    
    expect(state.owner.toBase58()).to.equal(programProvider.wallet.publicKey.toBase58());
  });

  it("Init producer", async () => {
    const producer = anchor.web3.Keypair.generate();
    const resource = anchor.web3.Keypair.generate();
    await initResource(program, resource, "A", []);

    let result = await initProcessor(program, producer, resource, 1);
    
    expect(result.owner.toBase58()).to.equal(provider.wallet.publicKey.toBase58());
    expect(result.outputRate.toNumber()).to.equal(1);
    expect(result.resourceId.toBase58()).to.equal(resource.publicKey.toBase58());
  });

  it("Init storage", async () => {
    const storage = anchor.web3.Keypair.generate();
    const resource = anchor.web3.Keypair.generate();
    await initResource(program, resource, "A", []);

    let result = await initStorage(program, storage, resource, 5);
    
    expect(result.owner.toBase58()).to.equal(provider.wallet.publicKey.toBase58());
    expect(result.amount.toNumber()).to.equal(0);
    expect(result.capacity.toNumber()).to.equal(5);
    expect(result.resourceId.toBase58()).to.equal(resource.publicKey.toBase58());
  });

  it("Init unit", async () => {
    const p1: KP = anchor.web3.Keypair.generate();
    let pk = provider.wallet.publicKey;
    let startPos: [number, number] = [1, 1];
    let startLocationPda = await initLocation2(program, "loc1", startPos, 10, {space:{}});
    let unitName = "s1";

    await initUnit(program, unitName, startPos);
    let unitBeforeMove = await fetchUnitState(program, pk, unitName);

    expect(unitBeforeMove.name).equal(unitName)
    expect(unitBeforeMove.atLocationId.toBase58()).equal(startLocationPda.toBase58(), "Start location")
  });


});

describe("/Unit", () => {
  let provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.GotAMin as Program<GotAMin>;
  const programProvider = program.provider as anchor.AnchorProvider;
  
  it("Init and move unit", async () => {
    const p1: KP = anchor.web3.Keypair.generate();
    let pk = provider.wallet.publicKey;
    let startPos: [number, number] = [1, 1];
    let startLocationPda = await initLocation2(program, "loc1", startPos, 10, {space:{}});
    let targetPos: [number, number] = [2, 1];
    let targetLocationPda = await initLocation2(program, "loc2", targetPos, 10, {space:{}});
    let unitName = "s1";

    await initUnit(program, unitName, startPos);
    let unitBeforeMove = await fetchUnitState(program, pk, unitName);

    expect(unitBeforeMove.name).equal(unitName)
    expect(unitBeforeMove.atLocationId.toBase58()).equal(startLocationPda.toBase58(), "Start location")

    await moveUnit(program, unitBeforeMove, targetPos);
    let unitAfterMove = await fetchUnitState(program, pk, unitName);
    let unitLocationAfterMove = await fetchLocationStatePK(program, unitAfterMove.atLocationId);
    expect(unitAfterMove.atLocationId.toBase58()).equal(targetLocationPda.toBase58(), "Target location")
    expect(unitLocationAfterMove.posX.toNumber()).equal(2);
    expect(unitLocationAfterMove.posY.toNumber()).equal(1);
    
  });

  it("Move and explore", async () => {
    const p1: KP = anchor.web3.Keypair.generate();
    let pk = provider.wallet.publicKey;
    let startPos: [number, number] = [10, 2];
    let startLocationPda = await initLocation2(program, "loc10", startPos, 10, {space:{}});
    let targetPos: [number, number] = [11, 2];
    let targetLocationPda = await initLocation2(program, "loc11", targetPos, 10);
    let unitName = "s2";

    await initUnit(program, unitName, startPos);
    let unitBeforeMove = await fetchUnitState(program, pk, unitName);
    let unitLocationBeforeMove = await fetchLocationStatePK(program, unitBeforeMove.atLocationId);

    expect(unitBeforeMove.name).equal(unitName)
    expect(unitLocationBeforeMove.posX.toNumber()).equal(10, "Start location")
    expect(unitLocationBeforeMove.posY.toNumber()).equal(2, "Start location")

    await moveUnit(program, unitBeforeMove, targetPos);
    let unitAfterMove = await fetchUnitState(program, pk, unitName);
    let unitLocationAfterMove = await fetchLocationStatePK(program, unitAfterMove.atLocationId);
    expect(unitLocationAfterMove.posX.toNumber()).equal(11);
    expect(unitLocationAfterMove.posY.toNumber()).equal(2);
    expect(JSON.stringify(unitLocationAfterMove.locationType)).to.equal(JSON.stringify({space:{}}));
  });

});

describe("/Production", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.GotAMin as Program<GotAMin>;
  const programProvider = program.provider as anchor.AnchorProvider;

  it("Init producer", async () => {
    const producer = anchor.web3.Keypair.generate();
    const resource = anchor.web3.Keypair.generate();
    await initResource(program, resource, "A", []);

    let result = await initProcessor(program, producer, resource, 1);
    
    expect(result.owner.toBase58()).to.equal(programProvider.wallet.publicKey.toBase58());
    expect(result.outputRate.toNumber()).to.equal(1);
    expect(result.resourceId.toBase58()).to.equal(resource.publicKey.toBase58());
  });

  it("Produce 1 of resource A #prod1A", async () => {
    let prodRate = 1;
    let duration = 1;
    let [resource, _1] = await createResource(program, 'A', []);
    let [producer, _2] = await createProcessor(program, resource, prodRate, duration);
    let storage = await createStorage3(program, resource, 1);

    await produce_without_input(producer, storage, resource);

    await storage.refresh();
    expect(storage.amount, "storage amount").to.equal(prodRate);
  });

  it("Produce 2 of resource B with output rate 1", async () => {
    let producerProdRate = 1;
    let [resource, _1] = await createResource(program, 'B', []);
    let [producer, _2] = await createProcessor(program, resource, producerProdRate, 1);
    let storage = await createStorage3(program, resource, 2);

    await produce_without_input(producer, storage, resource);

    await new Promise(f => setTimeout(f, 2001)); // todo: delay 5+ seconds... 
    await produce_without_input(producer, storage, resource);

    storage.refresh();
    expect(storage.amount, "storage amount").to.equal(producerProdRate * 2);
  });

  it("Produce 2 of resource A and Storage below full capacity", async () => {
    let producerProdRate = 5;
    let [resource, _1] = await createResource(program, 'A', []);
    let [producer, _2] = await createProcessor(program, resource, producerProdRate, 1);
    let storage = await createStorage3(program, resource, 3);

    // Production in progress
    let storageResult = await produce_without_input(producer, storage, resource);
    let producerResult = await program.account.processor.fetch(producer.publicKey);

    storage.refresh();
    expect(producerResult.awaitingUnits.toNumber(), "producerResult.awaitingUnits").to.equal(2);
    expect(storage.amount, "storage amount").to.equal(3);
  });

  it("Produce 1 resource B from 2 A", async () => {
    let producerBProdRate = 1;
    let [resourceA, _1] = await createResource(program, 'A', []);
    let [producerA, _2] = await createProcessor(program, resourceA, 5, 1);
    let storageA = await createStorage3(program, resourceA, 5);
    let [resourceB, _4] = await createResource(program, 'B', [[resourceA, 2]]);
    let [producerB, _5] = await createProcessor(program, resourceB, producerBProdRate, 5);
    let storageB = await createStorage3(program, resourceB, 5);
    
    await produce_without_input(producerA, storageA, resourceA);
    storageA.refresh();
    expect(storageA.amount).to.equal(5);
    //await produce_without_input(program, producerA, storageA, resourceA);

    await produce_with_1_input(producerB, storageB, resourceB, storageA);
    let producerBResult = await program.account.processor.fetch(producerB.publicKey);
    
    storageA.refresh();
    storageB.refresh();
    expect(producerBResult.awaitingUnits.toNumber(), "producerBResult.awaitingUnits").to.equal(producerBProdRate);
    expect(storageB.amount, "storageBResult.amount").to.equal(0);
    expect(storageA.amount, "inputAResult.amount").to.equal(3);    

    // Production is done after delay
    await new Promise(f => setTimeout(f, 5001)); // todo: delay 5+ seconds... 
    storageB.refresh();
    let producerBResult2 = await program.account.processor.fetch(producerB.publicKey);

    expect(producerBResult2.awaitingUnits.toNumber(), "producerBResult2.awaitingUnits").to.equal(producerBProdRate);
    expect(storageB.amount, "storageBResult2.amount").to.equal(1);    
  });

  it("Produce 1 resource B from 2 A from a different location fails", async () => {
    let producerBProdRate = 1;
    let locationA = await createLocation(program, 'locA', [0, 0], 10);
    let [resourceA, _1] = await createResource(program, 'A', []);
    let [producerA, _2] = await createProcessor(program, resourceA, 5, 1);
    let storageA = await createStorage3(program, resourceA, 5, locationA);
    let locationB = await createLocation(program, 'locB', [50, 0], 10);
    let [resourceB, _4] = await createResource(program, 'B', [[resourceA, 2]]);
    let [producerB, _5] = await createProcessor(program, resourceB, producerBProdRate, 5, locationB);
    let storageB = await createStorage3(program, resourceB, 5, locationB);    

    try {
      await produce_with_1_input(producerB, storageB, resourceB, storageA);
    
      assert(false, "Expected to fail");
    } catch(e) {
      assertAnchorError(e, "DifferentLocations");
    }
  });

  it("Produce resource B with input A fails when A is empty", async () => {
    let location = await createLocation(program, 'locA', [0, 0], 10); // Why is DEFAULT_LOCATION not working?
    let [resourceA, _1] = await createResource(program, 'A', []);
    let storageA = await createStorage3(program, resourceA, 1, location);
    let [resourceB, _3] = await createResource(program, 'B', [[resourceA, 1]]);
    let [producerB, _4] = await createProcessor(program, resourceB, 2, 1, location);
    let storageB = await createStorage3(program, resourceB, 1, location);

    // await expect(stuff(program, producerB, resourceB, resourceA)).should.be.rejectedWith("I AM THE EXPECTED ERROR");
    try {
      await produce_with_1_input(producerB, storageB, resourceB, storageA);
      
      assert(false, "Expected to fail");
    } catch(e) {
      assertAnchorError(e, "InputStorageAmountTooLow");
    }
  });

  it("Produce 1 resource C from 1 A + 1 B", async () => {
    let location = await createLocation(program, 'locA', [0, 0], 10); // Why is DEFAULT_LOCATION not working?
    let producerCProdRate = 2;
    let [resourceA, _1] = await createResource(program, 'A', []);
    let [producerA, _2] = await createProcessor(program, resourceA, 1, 1, location);
    let storageA = await createStorage3(program, resourceA, 1, location);
    let [resourceB, _4] = await createResource(program, 'B', []);
    let [producerB, _5] = await createProcessor(program, resourceB, 1, 1, location);
    let storageB = await createStorage3(program, resourceB, 1, location);
    let [resourceC, _7] = await createResource(program, 'C', [[resourceA, 1], [resourceB, 1]]);
    let [producerC, _8] = await createProcessor(program, resourceC, producerCProdRate, 1, location);
    let storageC = await createStorage3(program, resourceC, 2, location);
    await produce_without_input(producerA, storageA, resourceA);
    await produce_without_input(producerB, storageB, resourceB);

    await produce_with_2_inputs(producerC, storageC, resourceC, storageA, storageB);
    let producerCResult = await program.account.processor.fetch(producerC.publicKey);
    storageA.refresh();
    storageB.refresh();
    storageC.refresh();

    expect(producerCResult.awaitingUnits.toNumber(), "producerCResult.awaitingUnits").to.equal(0);
    expect(storageC.amount, "storageCResult.amount").to.equal(2);
    expect(storageA.amount, "inputAResult.amount").to.equal(0);    
    expect(storageB.amount, "inputBResult.amount").to.equal(0);    
  });

});

describe("/Sending", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.GotAMin as Program<GotAMin>;
  const programProvider = program.provider as anchor.AnchorProvider;

  it("Init sender", async () => {
    const sender = anchor.web3.Keypair.generate();
    const resource = anchor.web3.Keypair.generate();
    await initResource(program, resource, "A", []);

    let result = await initProcessor(program, sender, resource, 1, 1, DEFAULT_LOCATION, {sender:{}});
    
    expect(result.owner.toBase58()).to.equal(programProvider.wallet.publicKey.toBase58());
    expect(JSON.stringify(result.processorType)).to.equal(JSON.stringify({sender:{}}));
  });

  it("Send 1 resource A #send1A", async () => {
    let location1 = await createLocation(program, 'loc1', [1, 0], 9999);
    let location2 = await createLocation(program, 'loc2', [2, 0], 9999);
    let producerProdRate = 1;
    let [resource, _1] = await createResource(program, 'A', []);
    let producer = await createProcessor2(program, resource, producerProdRate, 1, location1);
    let sender = await createProcessor2(program, resource, producerProdRate, 1, location1, {sender:{}});
    let storage1 = await createStorage3(program, resource, 10, location1);
    let storage2 = await createStorage3(program, resource, 10, location2);

    await produce_without_input(producer, storage1, resource);
    
    await storage1.refresh();
    expect(storage1.amount, "ready to transfer").greaterThan(0);

    await produce_with_1_input(sender, storage2, resource, storage1);
    
    //await new Promise(f => setTimeout(f, 5001)); // todo: delay 5+ seconds... 

    storage1.refresh();
    storage2.refresh();
    expect(storage2.amount, "sent").to.equal(99);
  });
});

describe("/Transportation", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.GotAMin as Program<GotAMin>;
  const programProvider = program.provider as anchor.AnchorProvider;

  it("Move movable Storage", async () => {
    let [resource, _1] = await createResource(program, 'A', []);
    let location1 = await createLocation(program, 'loc1', [0, 0], 10);
    let storage = await createStorage3(program, resource, 10, location1, {movable:{}}, 2);
    let location2 = await createLocation(program, 'loc2', [2, 0], 10);

    await move_storage(program, storage, location1, location2);

    await storage.refresh();
    expect(storage.locationId.toBase58()).to.equal(location2.toBase58());
    expect(storage.arrivesAt).to.greaterThan(0);

    // Production is done after delay
    await new Promise(f => setTimeout(f, 5001)); // todo: delay 5+ seconds... 

    await updateStorageMoveStatus(program, storage);

    await storage.refresh();
    expect(storage.locationId.toBase58()).to.equal(location2.toBase58());
    expect(storage.arrivesAt).to.equal(0);
  });

  it("Add to Storage while moving should fail", async () => {
    let [resource, _1] = await createResource(program, 'A', []);
    let location1 = await createLocation(program, 'loc1', [0, 0], 10);
    let [producer, _2] = await createProcessor(program, resource, 10, 1, location1);
    let storage = await createStorage3(program, resource, 10, location1, {movable:{}});
    let location2 = await createLocation(program, 'loc2', [10, 0], 10);
    await move_storage(program, storage, location1, location2);
  
    try {
      await produce_without_input(producer, storage, resource);

      assert(false, "Expected to fail");
    } catch(e) {
      assertAnchorError(e, "DifferentLocations");
    }

    // Production is done after delay
    await new Promise(f => setTimeout(f, 3001)); // todo: delay 5+ seconds... 

    await storage.refresh();
    expect(storage.locationId.toBase58()).to.equal(location2.toBase58());
  });
});

describe("/Storage", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.GotAMin as Program<GotAMin>;
  const programProvider = program.provider as anchor.AnchorProvider;

  it("Init storage", async () => {
    const storage = anchor.web3.Keypair.generate();
    const resource = anchor.web3.Keypair.generate();
    await initResource(program, resource, "A", []);

    let result = await initStorage(program, storage, resource, 5);
    
    expect(result.owner.toBase58()).to.equal(programProvider.wallet.publicKey.toBase58());
    expect(result.amount.toNumber()).to.equal(0);
    expect(result.capacity.toNumber()).to.equal(5);
    expect(result.resourceId.toBase58()).to.equal(resource.publicKey.toBase58());
  });

  it("Storage full", async () => {
    let [resource, _1] = await createResource(program, 'A', []);
    let [producer, _2] = await createProcessor(program, resource, 10, 1);
    let storageFrom = await createStorage3(program, resource, 10);
    let storageTo = await createStorage3(program, resource, 3);
    await produce_without_input(producer, storageFrom, resource);

    try {
      await move_between_storage(storageFrom, storageTo, 5);

      assert(false, "Expected to fail");
    } catch(e) {
      assertAnchorError(e, "StorageFull");
    }
  });

  it("Storage with amount too low", async () => {
    let [resource, _1] = await createResource(program, 'A', []);
    let [producer, _2] = await createProcessor(program, resource, 10, 1);
    let storageFrom = await createStorage3(program, resource, 10);
    let storageTo = await createStorage3(program, resource, 100);
    await produce_without_input(producer, storageFrom, resource);

    try {
      await move_between_storage(storageFrom, storageTo, 25);

      assert(false, "Expected to fail");
    } catch(e) {
      assertAnchorError(e, "StorageAmountTooLow");
    }
  });
    
  it("Move between Storage with different resources", async () => {
    let [resourceA, _1] = await createResource(program, 'A', []);
    let [producerA, _2] = await createProcessor(program, resourceA, 10, 1);
    let storageAFrom = await createStorage3(program, resourceA, 10);
    let [resourceB, _4] = await createResource(program, 'B', []);
    let [producerB, _5] = await createProcessor(program, resourceB, 10, 1);
    let storageBTo = await createStorage3(program, resourceB, 100);
    await produce_without_input(producerA, storageAFrom, resourceA);
    await produce_without_input(producerB, storageBTo, resourceB);

    try {
      await move_between_storage(storageAFrom, storageBTo, 1);

      assert(false, "Expected to fail");
    } catch(e) {
      assertAnchorError(e, "ResourceNotMatching");
    }
  });
    
});

describe("/Location", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.GotAMin as Program<GotAMin>;
  const programProvider = program.provider as anchor.AnchorProvider;
  const pk = programProvider.wallet.publicKey;

  it("Init location", async () => {
    let pos: [number, number] = [0, 0];

    await initLocation2(program, 'name', pos, 5);
    let state = await fetchLocationState(program, pk, pos);
    
    expect(state.owner.toBase58()).to.equal(pk.toBase58());
    expect(state.posX).to.equal(0);
    expect(state.capacity.toNumber()).to.equal(5);
    expect(state.name).to.equal('name');
  });

  it("Move between Storage in different locations", async () => {
    let [resource, _1] = await createResource(program, 'A', []);
    let locationA = await createLocation(program, 'locA', [0, 0], 10);
    let [producerA, _2] = await createProcessor(program, resource, 10, 0, locationA);
    let storageAFrom = await createStorage3(program, resource, 10, locationA);
    let locationB = await createLocation(program, 'locB', [1, 0], 10);
    let storageBTo = await createStorage3(program, resource, 100, locationB);
    await produce_without_input(producerA, storageAFrom, resource);

    try {
      await move_between_storage(storageAFrom, storageBTo, 1);

      assert(false, "Expected to fail");
    } catch(e) {
      assertAnchorError(e, "DifferentLocations");
    }
  });

  it("Producer and Storage in different locations", async () => {
    let [resource, _1] = await createResource(program, 'A', []);
    let location = await createLocation(program, 'locA', [0, 0], 10);
    let [producer, _2] = await createProcessor(program, resource, 10, 0);
    let storage = await createStorage3(program, resource, 10, location);

    try {
      await produce_without_input(producer, storage, resource);

      assert(false, "Expected to fail");
    } catch(e) {
      assertAnchorError(e, "DifferentLocations");
    }
  });  

  it("Move static Storage fails", async () => {
    let [resource, _1] = await createResource(program, 'A', []);
    let location1 = await createLocation(program, 'loc1', [0, 0], 10);
    let storage = await createStorage3(program, resource, 10, location1);
    let location2 = await createLocation(program, 'loc2', [1, 0], 10);

    try {
      await move_storage(program, storage, location1, location2);

      assert(false, "Expected to fail");
    } catch(e) {
      assertAnchorError(e, "StorageTypeNotMovable");
    }
  });  

  it("Move Storage to full Location fails", async () => {
    let [resource, _1] = await createResource(program, 'A', []);
    let location1 = await createLocation(program, 'loc1', [0, 0], 10);
    let storage = await createStorage3(program, resource, 10, location1, {movable:{}});
    let location2 = await createLocation(program, 'loc2', [1, 0], 0);

    try {
      await move_storage(program, storage, location1, location2);

      assert(false, "Expected to fail");
    } catch(e) {
      assertAnchorError(e, "LocationFull");
    }
  });

  it("Move Storage to new Location", async () => {
    let [resource, _1] = await createResource(program, 'A', []);
    let location1 = await createLocation(program, 'loc1', [0, 0], 10);
    let storage = await createStorage3(program, resource, 10, location1, {movable:{}});
    let location2 = await createLocation(program, 'loc2', [1, 0], 10);

    await move_storage(program, storage, location1, location2);
    await storage.refresh();
    let location1Result = await program.account.location.fetch(location1);
    let location2Result = await program.account.location.fetch(location2);

    expect(storage.locationId.toBase58()).equal(location2.toBase58());
    expect(location1Result.occupiedSpace.toNumber()).equal(0);
    expect(location2Result.occupiedSpace.toNumber()).equal(1);
  });  

  it("init_stuff", async () => {
    const program = anchor.workspace.GotAMin as Program<GotAMin>;
    const provider = program.provider as anchor.AnchorProvider;
    let pk = provider.wallet.publicKey;

    let num2 = 999;
    let pos: [number, number] = [1, 2];
    let locPda = getLocationPda(program, pk, pos);
    console.log("pda", locPda.toBase58());
    let loc = await initLocation2(program, "loc1", pos, 10, {space:{}});

    let num = new anchor.BN(num2);
    let buffer = num.toArray('le', 8);
    console.log("stuff. num: ", num, ", toArray().len: ", buffer.length);
    buffer.forEach((i) => {
      console.log("buffer: ", i);
    });
    let uint8: Uint8Array = new Uint8Array(buffer);
    uint8.forEach((i) => {
      console.log("uint8: ", i);
    });

    await program.methods
    .stuff(new anchor.BN(1), new anchor.BN(2))
    .accounts({
      owner: programProvider.wallet.publicKey,
      location: locPda,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

  });

/*  it("update stuff", async () => {
    let key = new anchor.web3.PublicKey("FCHm4Ef3b1aKpBPTk6XkKsQwf8Z3zUhkh6VbZuSrwDi8");
    console.log("Updating: ", key.toBase58());

    await program.methods
    .updateStuff(new anchor.BN(999))
    .accounts({
      stuff: key,
    })
    .signers(key)
    .rpc();

    let res = await program.account.stuff.fetch(account.publicKey);
    expect(res.number.toNumber()).equal(123);
  });

  it("read stuff", async () => {
    let key = new anchor.web3.PublicKey("FCHm4Ef3b1aKpBPTk6XkKsQwf8Z3zUhkh6VbZuSrwDi8");
    console.log("Fetching location for: ", key.toBase58());

    let res = await program.account.stuff.fetch(key);

    console.log("stuff: ", res.number.toNumber());
  });
  */
});

function assertAnchorError(error: any, errorName: String) {
  if(error instanceof AnchorError) {
    expect(error, "Expected to be of type AnchorError").to.be.instanceOf(AnchorError);
    let anchorError: AnchorError = error;
    expect(anchorError.error.errorCode.code).to.equal(errorName);  
  } else {
    throw error;
  }
}

async function createResource(program: Program<GotAMin>, name: string, inputs):  Promise<[KP, any]> {
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

async function createProcessor(program: Program<GotAMin>, resource, outputRate, processingDuration = 5, location = DEFAULT_LOCATION, type: ProcessorType = {producer:{}}): Promise<[KP, any]> {
  const processor = anchor.web3.Keypair.generate();
  return [processor, await initProcessor(program, processor, resource, outputRate, processingDuration, location, type)];
}

async function createProcessor2(program: Program<GotAMin>, resource, outputRate, processingDuration = 5, location = DEFAULT_LOCATION, type: ProcessorType = {producer:{}}): Promise<KP> {
  const processor = anchor.web3.Keypair.generate();
  await initProcessor(program, processor, resource, outputRate, processingDuration, location, type);
  return processor;
}

async function initProcessor(program: Program<GotAMin>, processor, resource, outputRate, processingDuration = 5, location = DEFAULT_LOCATION, type: ProcessorType = {producer:{}}) {
  assert(outputRate > 0, 'initProcessor requirement: outputRate > 0');
  assert(processingDuration > 0, 'initProcessor requirement: processingDuration > 0');
  const programProvider = program.provider as anchor.AnchorProvider;
  const outputRateBN = new anchor.BN(outputRate);
  const processingDurationBN = new anchor.BN(processingDuration);

  await program.methods
    .initProcessor(type, resource.publicKey, outputRateBN, processingDurationBN)
    .accounts({
      processor: processor.publicKey,
      location: location,
      owner: programProvider.wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers(processor)
    .rpc();
    
    return await program.account.processor.fetch(processor.publicKey);
}

async function createStorageNew(
  program: Program<GotAMin>,
  owner: KP,
  resource: KP, 
  capacity: number, 
  location: PublicKey = DEFAULT_LOCATION, 
  mobilityType: MobilityType = {fixed:{}}, 
  speed: number = 1,
): Promise<[KP, any]> {
  const storage: KP = anchor.web3.Keypair.generate();
  return [storage, await initStorageNew(program, owner, storage, resource, capacity, location, mobilityType, speed)];
}

async function initStorageNew(
  program: Program<GotAMin>, 
  owner: KP,
  storage, resource: KP, 
  capacity: number, 
  location: PublicKey = DEFAULT_LOCATION, 
  mobilityType: MobilityType = {fixed:{}}, 
  speed: number = 1,
) {
  const programProvider = program.provider as anchor.AnchorProvider;
  let locationState = await fetchLocationStatePK(program, location);

  await program.methods
    .initStorage(resource.publicKey, new anchor.BN(capacity), mobilityType, new anchor.BN(speed), locationState.posX, locationState.posY)
    .accounts({
      storage: storage.publicKey,
      location: location,
      owner: owner.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([storage, owner])
    .rpc();
    
  return await program.account.storage.fetch(storage.publicKey);
}

async function createStorage(
  program: Program<GotAMin>,
  resource: KP, 
  capacity: number, 
  location: PublicKey = DEFAULT_LOCATION, 
  mobilityType: MobilityType = {fixed:{}}, 
  speed: number = 1,
): Promise<[KP, any]> {
  const storage: KP = anchor.web3.Keypair.generate();
  return [storage, await initStorage(program, storage, resource, capacity, location, mobilityType, speed)];
}

async function createStorage3(
  program: Program<GotAMin>,
  resource: KP, 
  capacity: number, 
  location: PublicKey = DEFAULT_LOCATION, 
  mobilityType: MobilityType = {fixed:{}}, 
  speed: number = 1,
): Promise<StorageState> {
  let [keyPair, b] = await createStorage(program, resource, capacity, location, mobilityType, speed);
  let state = new StorageState(program, keyPair);
  return await state.refresh();
}

class StorageState {
  readonly program: Program<GotAMin>;
  readonly keyPair: KP;
  amount: number;
  arrivesAt: number;
  locationId: PublicKey;

  constructor(program: Program<GotAMin>, keyPair: KP) {
    this.program = program;
    this.keyPair = keyPair;
  }

  getPubKey(): PublicKey {
    return this.keyPair.publicKey;
  }

  async refresh(): Promise<StorageState> {
    let state = await this.program.account.storage.fetch(this.getPubKey());
    this.amount = state.amount.toNumber();
    this.arrivesAt = state.arrivesAt.toNumber();
    this.locationId = state.locationId;
    return this;
  }

}

async function createStorage2(
  program: Program<GotAMin>,
  resource: KP, 
  capacity: number, 
  location: PublicKey = DEFAULT_LOCATION, 
  mobilityType: MobilityType = {fixed:{}}, 
  speed: number = 1,
): Promise<[Program<GotAMin>, KP]> {
  const storage: KP = anchor.web3.Keypair.generate();
  await initStorage(program, storage, resource, capacity, location, mobilityType, speed);
  return [program, storage];
}

async function initStorage(
  program: Program<GotAMin>, 
  storage: KP, 
  resource: KP, 
  capacity: number, 
  location: PublicKey = DEFAULT_LOCATION, 
  mobilityType: MobilityType = {fixed:{}}, 
  speed: number = 1,
) {
  const programProvider = program.provider as anchor.AnchorProvider;
  let locationState = await fetchLocationStatePK(program, location);

  await program.methods
    .initStorage(resource.publicKey, new anchor.BN(capacity), mobilityType, new anchor.BN(speed), locationState.posX, locationState.posY)
    .accounts({
      storage: storage.publicKey,
      location: location,
      owner: programProvider.wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([storage])
    .rpc();
    
  return await program.account.storage.fetch(storage.publicKey);
}

async function createLocation(program: Program<GotAMin>, name: string, position: [number, number], capacity: number):  Promise<PublicKey> {
  return await initLocation2(program, name, position, capacity);
}

async function initDefaultLocation(program: Program<GotAMin>) {
  const provider = program.provider as anchor.AnchorProvider;
  let pos: [number, number] = [9999, 9999];
  return initLocation2(program, 'default', pos, 999);
}

async function initLocation(program: Program<GotAMin>, location, name: string, position: [number, number], capacity: number) {
  return initLocation2(program, name, position, capacity);
}
async function initLocation2(program: Program<GotAMin>, name: string, position: [number, number], capacity: number, locationType = null): Promise<PublicKey> {
  const provider = program.provider as anchor.AnchorProvider;
  let pk = provider.wallet.publicKey;

  let x = position[0];
  let y = position[1];
  let locationPda = getLocationPda(program, pk, position);
  
  const pdaInfo = await provider.connection.getAccountInfo(locationPda);
  if(pdaInfo == null) {
    await program.methods
      .initLocation(name, new anchor.BN(x), new anchor.BN(y), new anchor.BN(capacity), locationType)
      .accounts({
        location: locationPda,
        owner: pk,
      })
      .rpc();
  }

  return locationPda;
}

async function moveUnit(program: Program<GotAMin>, unit, toPos): Promise<PublicKey> {
  const provider = program.provider as anchor.AnchorProvider;
  let pk = provider.wallet.publicKey;

  let unitPda = getUnitPda(program, pk, unit.name);
  let currentLocation = await fetchLocationStatePK(program, unit.atLocationId);
  let fromPos: [number, number] = [currentLocation.posX, currentLocation.posY];
  let toLocationPda = getLocationPda(program, pk, toPos);
  let fromX = new anchor.BN(currentLocation.posX);
  let fromY = new anchor.BN(currentLocation.posY);
  let toX = new anchor.BN(toPos[0]);
  let toY = new anchor.BN(toPos[1]);
  
  await program.methods
    .moveUnit(fromX, fromY, toX, toY, unit.name)
    .accounts({
      unit: unitPda,
      fromLocation: unit.atLocationId,
      toLocation: toLocationPda,
      owner: pk,
    })
    .rpc();

  return unit;
}

async function initUnit(program: Program<GotAMin>, name: string, pos: [number, number]): Promise<PublicKey> {
  const provider = program.provider as anchor.AnchorProvider;
  let pk = provider.wallet.publicKey;
  let x = pos[0];
  let y = pos[1];

  let unitPda = getUnitPda(program, pk, name);
  let locationPda = getLocationPda(program, pk, pos);
  
  const pdaInfo = await provider.connection.getAccountInfo(unitPda);
  if(pdaInfo == null) {
    await program.methods
      .initUnit(name, new anchor.BN(x), new anchor.BN(y))
      .accounts({
        unit: unitPda,
        location: locationPda,
        owner: pk,
      })
      .rpc();
  }

  return unitPda;
}

async function produce_without_input(producer, storage: StorageState, resource) {
  let program = storage.program;
  const programProvider = program.provider as anchor.AnchorProvider;

  await program.methods
    .produceWithoutInput()
    .accounts({
      processor: producer.publicKey,
      storage: storage.getPubKey(),
      resource: resource.publicKey,
    })
    .rpc();
}

async function produce_with_1_input(producer, storage: StorageState, resourceToProduce, storageInput: StorageState) {
  let program = storage.program;
  const programProvider = program.provider as anchor.AnchorProvider;

  await program.methods
    .produceWithOneInput()
    .accounts({
      processor: producer.publicKey,
      storage: storage.getPubKey(),
      resourceToProduce: resourceToProduce.publicKey,
      storageInput: storageInput.getPubKey(),      
    })
    .rpc();
}

async function produce_with_2_inputs(producer, storage: StorageState, resourceToProduce, storageInput1: StorageState, storageInput2: StorageState) {
  let program = storage.program;
  const programProvider = program.provider as anchor.AnchorProvider;

  await program.methods
    .produceWithTwoInputs()
    .accounts({
      processor: producer.publicKey,
      storage: storage.getPubKey(),
      resourceToProduce: resourceToProduce.publicKey,
      storageInput1: storageInput1.getPubKey(),
      storageInput2: storageInput2.getPubKey(),
    })
    .rpc();
}

async function move_between_storage(storageFrom: StorageState, storageTo, amount: number) {
  let program = storageFrom.program;
  const programProvider = program.provider as anchor.AnchorProvider;

  await program.methods
    .moveBetweenStorage(new anchor.BN(amount))
    .accounts({
      storageFrom: storageFrom.getPubKey(),
      storageTo: storageTo.publicKey,
    })
    .rpc();
}

async function move_storage(program: Program<GotAMin>, storage: StorageState, fromLocation, toLocation) {
  const programProvider = program.provider as anchor.AnchorProvider;

  await program.methods
    .moveStorage()
    .accounts({
      storage: storage.getPubKey(),
      fromLocation: fromLocation.publicKey,
      toLocation: toLocation.publicKey,
    })
    .rpc();
}

async function updateStorageMoveStatus(program: Program<GotAMin>, storage: StorageState) {
  const programProvider = program.provider as anchor.AnchorProvider;

  await program.methods
    .updateStorageMoveStatus()
    .accounts({
      storage: storage.getPubKey(),
    })
    .rpc();
}

async function getStorageState(id: [Program<GotAMin>, KP]): Promise<any> {
  let [program, storageId] = id;
  return await program.account.storage.fetch(storageId.publicKey);
}

function failNotImplemented() {
  expect(false, "Not implemented").to.equal(true);
}
