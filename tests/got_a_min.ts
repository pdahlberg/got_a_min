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

  //DEFAULT_LOCATION = await initDefaultLocation(program);
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
  return getPda(program, pk, "map-location", new Uint8Array(pos));
}

function getUnitPda(program, pk: PublicKey): PublicKey {
  const [pda, _] = PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("unit"),
      pk.toBuffer(),
    ],
    program.programId,
  );
  return pda;
}

function getPda(program, pk: PublicKey, key, extraSeeds: Uint8Array): PublicKey {
  const [pda, _] = PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode(key),
      pk.toBuffer(),
      extraSeeds,
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

async function fetchUnitStatePK(program, unitPda: PublicKey) {
  return await program.account.unit.fetch(unitPda);
}

async function fetchUnitState(program, pk) {
  let pda = getUnitPda(program, pk);
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
  
  it("unit", async () => {
    const p1: KP = anchor.web3.Keypair.generate();
    let pk = provider.wallet.publicKey;
    let unitPda = getUnitPda(program, pk);
    let pos: [number, number] = [1, 1];

    await initLocation2(program, "loc1", pos, 10);
    await initUnit(program, "spaceship", pos);
    let unit = await fetchUnitState(program, pk);

    expect(unit.name).equal("spaceship")
    //expect(unit.atLocationId.toBase58()).equal("unit")
  });

  it.skip("pda-1", async () => {
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

  it.skip("simple storage", async () => {
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
  const programProvider = program.provider as anchor.AnchorProvider;

  it("Init resource", async () => {
    const resource = anchor.web3.Keypair.generate();

    let result = await initResource(program, resource, "A", []);
    
    expect(result.owner.toBase58()).to.equal(programProvider.wallet.publicKey.toBase58());
  });

  it("Init resource with input", async () => {
    const resource = anchor.web3.Keypair.generate();
    let [resourceA, _] = await createResource(program, "A", []);

    let result = await initResource(program, resource, "B", [[resourceA as KP, 1]]);
    
    expect(result.owner.toBase58()).to.equal(programProvider.wallet.publicKey.toBase58());
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
    
    expect(result.owner.toBase58()).to.equal(programProvider.wallet.publicKey.toBase58());
    expect(result.outputRate.toNumber()).to.equal(1);
    expect(result.resourceId.toBase58()).to.equal(resource.publicKey.toBase58());
  });

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
    let duration = 10;
    let [resource, _1] = await createResource(program, 'A', []);
    let [producer, _2] = await createProcessor(program, resource, prodRate, duration);
    let [storage, _3] = await createStorage(program, resource, 1);

    // Production in progress
    let storageResult = await produce_without_input(program, producer, storage, resource);
    let producerResult = await program.account.processor.fetch(producer.publicKey);
    

    expect(producerResult.awaitingUnits.toNumber(), "1) producer awaitingUnits").to.equal(prodRate);
    expect(storageResult.resourceId.toBase58()).to.equal(resource.publicKey.toBase58());
    expect(storageResult.amount.toNumber(), "storage amount").to.equal(0);

    // Production is done after delay
    await new Promise(f => setTimeout(f, 5001)); // todo: delay 5+ seconds... 
    let storageResult2 = await produce_without_input(program, producer, storage, resource);
    let producerResult2 = await program.account.processor.fetch(producer.publicKey);

    expect(producerResult2.awaitingUnits.toNumber(), "2) producer awaitingUnits").to.equal(prodRate);
    expect(storageResult2.amount.toNumber(), "storage amount").to.equal(prodRate);
  });

  it("Produce 2 of resource B with output rate 1", async () => {
    let producerProdRate = 1;
    let [resource, _1] = await createResource(program, 'B', []);
    let [producer, _2] = await createProcessor(program, resource, producerProdRate, 1);
    let [storage, _3] = await createStorage(program, resource, 2);

    await produce_without_input(program, producer, storage, resource);

    await new Promise(f => setTimeout(f, 2001)); // todo: delay 5+ seconds... 
    let storageResult = await produce_without_input(program, producer, storage, resource);

    expect(storageResult.amount.toNumber(), "storage amount").to.equal(producerProdRate * 2);
  });

  it("Produce 2 of resource A and Storage below full capacity", async () => {
    let producerProdRate = 5;
    let [resource, _1] = await createResource(program, 'A', []);
    let [producer, _2] = await createProcessor(program, resource, producerProdRate, 1);
    let [storage, _3] = await createStorage(program, resource, 3);

    // Production in progress
    let storageResult = await produce_without_input(program, producer, storage, resource);
    let producerResult = await program.account.processor.fetch(producer.publicKey);

    expect(producerResult.awaitingUnits.toNumber(), "producerResult.awaitingUnits").to.equal(2);
    expect(storageResult.amount.toNumber(), "storage amount").to.equal(3);
  });

  it("Produce 1 resource B from 2 A", async () => {
    let producerBProdRate = 1;
    let [resourceA, _1] = await createResource(program, 'A', []);
    let [producerA, _2] = await createProcessor(program, resourceA, 5, 1);
    let [storageA, _3] = await createStorage(program, resourceA, 5);
    let [resourceB, _4] = await createResource(program, 'B', [[resourceA, 2]]);
    let [producerB, _5] = await createProcessor(program, resourceB, producerBProdRate, 5);
    let [storageB, _6] = await createStorage(program, resourceB, 5);
    
    let storageAResult = await produce_without_input(program, producerA, storageA, resourceA);
    expect(storageAResult.amount.toNumber()).to.equal(5);
    //await produce_without_input(program, producerA, storageA, resourceA);

    let storageBResult = await produce_with_1_input(program, producerB, storageB, resourceB, storageA);
    let producerBResult = await program.account.processor.fetch(producerB.publicKey);
    let inputAResult = await program.account.storage.fetch(storageA.publicKey);

    expect(producerBResult.awaitingUnits.toNumber(), "producerBResult.awaitingUnits").to.equal(producerBProdRate);
    expect(storageBResult.amount.toNumber(), "storageBResult.amount").to.equal(0);
    expect(inputAResult.amount.toNumber(), "inputAResult.amount").to.equal(3);    

    // Production is done after delay
    await new Promise(f => setTimeout(f, 5001)); // todo: delay 5+ seconds... 
    let storageBResult2 = await produce_with_1_input(program, producerB, storageB, resourceB, storageA);
    let producerBResult2 = await program.account.processor.fetch(producerB.publicKey);

    expect(producerBResult2.awaitingUnits.toNumber(), "producerBResult2.awaitingUnits").to.equal(producerBProdRate);
    expect(storageBResult2.amount.toNumber(), "storageBResult2.amount").to.equal(1);    
  });

  it("Produce 1 resource B from 2 A from a different location fails", async () => {
    let producerBProdRate = 1;
    let locationA = await createLocation(program, 'locA', [0, 0], 10);
    let [resourceA, _1] = await createResource(program, 'A', []);
    let [producerA, _2] = await createProcessor(program, resourceA, 5, 1);
    let [storageA, _3] = await createStorage(program, resourceA, 5, locationA);
    let locationB = await createLocation(program, 'locB', [50, 0], 10);
    let [resourceB, _4] = await createResource(program, 'B', [[resourceA, 2]]);
    let [producerB, _5] = await createProcessor(program, resourceB, producerBProdRate, 5, locationB);
    let [storageB, _6] = await createStorage(program, resourceB, 5, locationB);    

    try {
      await produce_with_1_input(program, producerB, storageB, resourceB, storageA);
    
      assert(false, "Expected to fail");
    } catch(e) {
      assertAnchorError(e, "DifferentLocations");
    }
  });

  it("Produce resource B with input A fails when A is empty", async () => {
    let location = await createLocation(program, 'locA', [0, 0], 10); // Why is DEFAULT_LOCATION not working?
    let [resourceA, _1] = await createResource(program, 'A', []);
    let [storageA, _2] = await createStorage(program, resourceA, 1, location);
    let [resourceB, _3] = await createResource(program, 'B', [[resourceA, 1]]);
    let [producerB, _4] = await createProcessor(program, resourceB, 2, 1, location);
    let [storageB, _5] = await createStorage(program, resourceB, 1, location);

    // await expect(stuff(program, producerB, resourceB, resourceA)).should.be.rejectedWith("I AM THE EXPECTED ERROR");
    try {
      await produce_with_1_input(program, producerB, storageB, resourceB, storageA);
      
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
    let [storageA, _3] = await createStorage(program, resourceA, 1, location);
    let [resourceB, _4] = await createResource(program, 'B', []);
    let [producerB, _5] = await createProcessor(program, resourceB, 1, 1, location);
    let [storageB, _6] = await createStorage(program, resourceB, 1, location);
    let [resourceC, _7] = await createResource(program, 'C', [[resourceA, 1], [resourceB, 1]]);
    let [producerC, _8] = await createProcessor(program, resourceC, producerCProdRate, 1, location);
    let [storageC, _9] = await createStorage(program, resourceC, 2, location);
    await produce_without_input(program, producerA, storageA, resourceA);
    await produce_without_input(program, producerB, storageB, resourceB);

    let storageCResult = await produce_with_2_inputs(program, producerC, storageC, resourceC, storageA, storageB);
    let producerCResult = await program.account.processor.fetch(producerC.publicKey);
    let inputAResult = await program.account.storage.fetch(storageA.publicKey);
    let inputBResult = await program.account.storage.fetch(storageB.publicKey);

    expect(producerCResult.awaitingUnits.toNumber(), "producerCResult.awaitingUnits").to.equal(0);
    expect(storageCResult.amount.toNumber(), "storageCResult.amount").to.equal(2);
    expect(inputAResult.amount.toNumber(), "inputAResult.amount").to.equal(0);    
    expect(inputBResult.amount.toNumber(), "inputBResult.amount").to.equal(0);    
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

  it("Send 1 resource A", async () => {
    let location1 = await createLocation(program, 'loc1', [1, 0], 10);
    let location2 = await createLocation(program, 'loc1', [2, 0], 10);
    let producerProdRate = 1;
    let [resource, _1] = await createResource(program, 'A', []);
    let producer = await createProcessor2(program, resource, producerProdRate, 1);
    let sender = await createProcessor2(program, resource, producerProdRate, 1);
    let storage1Id = await createStorage2(program, resource, 10, location1);
    let storage2Id = await createStorage2(program, resource, 10, location2);

    let storage2 = await getStorageState(storage2Id);
    expect(storage2.amount.toNumber(), "storage amount").to.equal(producerProdRate);
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
    let [storage, _3] = await createStorage(program, resource, 10, location1, {movable:{}}, 2);
    let location2 = await createLocation(program, 'loc2', [2, 0], 10);

    await move_storage(program, storage, location1, location2);

    let result1 = await program.account.storage.fetch(storage.publicKey);
    expect(result1.locationId.toBase58()).to.equal(location2.toBase58());
    expect(result1.arrivesAt.toNumber()).to.greaterThan(0);

    // Production is done after delay
    await new Promise(f => setTimeout(f, 5001)); // todo: delay 5+ seconds... 

    await updateStorageMoveStatus(program, storage);

    let result2 = await program.account.storage.fetch(storage.publicKey);
    expect(result2.locationId.toBase58()).to.equal(location2.toBase58());
    expect(result2.arrivesAt.toNumber()).to.equal(0);
  });

  it("Add to Storage while moving should fail", async () => {
    let [resource, _1] = await createResource(program, 'A', []);
    let location1 = await createLocation(program, 'loc1', [0, 0], 10);
    let [producer, _2] = await createProcessor(program, resource, 10, 1, location1);
    let [storage, _3] = await createStorage(program, resource, 10, location1, {movable:{}});
    let location2 = await createLocation(program, 'loc2', [10, 0], 10);
    await move_storage(program, storage, location1, location2);
  
    try {
      await produce_without_input(program, producer, storage, resource);

      assert(false, "Expected to fail");
    } catch(e) {
      assertAnchorError(e, "DifferentLocations");
    }

    // Production is done after delay
    await new Promise(f => setTimeout(f, 3001)); // todo: delay 5+ seconds... 

    let result2 = await program.account.storage.fetch(storage.publicKey);
    expect(result2.locationId.toBase58()).to.equal(location2.toBase58());
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
    let [storageFrom, _3] = await createStorage(program, resource, 10);
    let [storageTo, _4] = await createStorage(program, resource, 3);
    await produce_without_input(program, producer, storageFrom, resource);

    try {
      await move_between_storage(program, storageFrom, storageTo, 5);

      assert(false, "Expected to fail");
    } catch(e) {
      assertAnchorError(e, "StorageFull");
    }
  });

  it("Storage with amount too low", async () => {
    let [resource, _1] = await createResource(program, 'A', []);
    let [producer, _2] = await createProcessor(program, resource, 10, 1);
    let [storageFrom, _3] = await createStorage(program, resource, 10);
    let [storageTo, _4] = await createStorage(program, resource, 100);
    await produce_without_input(program, producer, storageFrom, resource);

    try {
      await move_between_storage(program, storageFrom, storageTo, 25);

      assert(false, "Expected to fail");
    } catch(e) {
      assertAnchorError(e, "StorageAmountTooLow");
    }
  });
    
  it("Move between Storage with different resources", async () => {
    let [resourceA, _1] = await createResource(program, 'A', []);
    let [producerA, _2] = await createProcessor(program, resourceA, 10, 1);
    let [storageAFrom, _3] = await createStorage(program, resourceA, 10);
    let [resourceB, _4] = await createResource(program, 'B', []);
    let [producerB, _5] = await createProcessor(program, resourceB, 10, 1);
    let [storageBTo, _6] = await createStorage(program, resourceB, 100);
    await produce_without_input(program, producerA, storageAFrom, resourceA);
    await produce_without_input(program, producerB, storageBTo, resourceB);

    try {
      await move_between_storage(program, storageAFrom, storageBTo, 1);

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
    let [storageAFrom, _3] = await createStorage(program, resource, 10, locationA);
    let locationB = await createLocation(program, 'locB', [1, 0], 10);
    let [storageBTo, _6] = await createStorage(program, resource, 100, locationB);
    await produce_without_input(program, producerA, storageAFrom, resource);

    try {
      await move_between_storage(program, storageAFrom, storageBTo, 1);

      assert(false, "Expected to fail");
    } catch(e) {
      assertAnchorError(e, "DifferentLocations");
    }
  });

  it("Producer and Storage in different locations", async () => {
    let [resource, _1] = await createResource(program, 'A', []);
    let location = await createLocation(program, 'locA', [0, 0], 10);
    let [producer, _2] = await createProcessor(program, resource, 10, 0);
    let [storage, _3] = await createStorage(program, resource, 10, location);

    try {
      await produce_without_input(program, producer, storage, resource);

      assert(false, "Expected to fail");
    } catch(e) {
      assertAnchorError(e, "DifferentLocations");
    }
  });  

  it("Move static Storage fails", async () => {
    let [resource, _1] = await createResource(program, 'A', []);
    let location1 = await createLocation(program, 'loc1', [0, 0], 10);
    let [storage, _3] = await createStorage(program, resource, 10, location1);
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
    let [storage, _3] = await createStorage(program, resource, 10, location1, {movable:{}});
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
    let [storage, _3] = await createStorage(program, resource, 10, location1, {movable:{}});
    let location2 = await createLocation(program, 'loc2', [1, 0], 10);

    await move_storage(program, storage, location1, location2);
    let storageResult = await program.account.storage.fetch(storage.publicKey);
    let location1Result = await program.account.location.fetch(location1);
    let location2Result = await program.account.location.fetch(location2);

    expect(storageResult.locationId.toBase58()).equal(location2.toBase58());
    expect(location1Result.occupiedSpace.toNumber()).equal(0);
    expect(location2Result.occupiedSpace.toNumber()).equal(1);
  });  

/*  it("init stuff", async () => {
    const account = anchor.web3.Keypair.generate();
    console.log("account: ", account.publicKey.toBase58());

    await program.methods
    .stuff()
    .accounts({
      stuff: account.publicKey,
      owner: programProvider.wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([account])
    .rpc();

    let res = await program.account.stuff.fetch(account.publicKey);
    expect(res.number.toNumber()).equal(123);
  });

  it("update stuff", async () => {
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

  await program.methods
    .initStorage(resource.publicKey, new anchor.BN(capacity), mobilityType, new anchor.BN(speed), [0, 0])
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
  storage, resource: KP, 
  capacity: number, 
  location: PublicKey = DEFAULT_LOCATION, 
  mobilityType: MobilityType = {fixed:{}}, 
  speed: number = 1,
) {
  const programProvider = program.provider as anchor.AnchorProvider;
  let locationState = await fetchLocationStatePK(program, location);
  let pos = [locationState.posX, locationState.posY];

  await program.methods
    .initStorage(resource.publicKey, new anchor.BN(capacity), mobilityType, new anchor.BN(speed), pos)
    .accounts({
      storage: storage.publicKey,
      location: location,
      owner: programProvider.wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers(storage)
    .rpc();
    
  return await program.account.storage.fetch(storage.publicKey);
}

async function createLocation(program: Program<GotAMin>, name: string, position: [number, number], capacity: number):  Promise<PublicKey> {
  return await initLocation2(program, name, position, capacity);
}

async function initDefaultLocation(program: Program<GotAMin>) {
  try {
    console.log("initDefaultLocation - 1");
    const programProvider = program.provider as anchor.AnchorProvider;
    let pk = programProvider.wallet.publicKey;
    let pos: [number, number] = [255, 255];
    let locationPda = getLocationPda(program, pk, pos);
    let state = await fetchLocationStatePK(program, locationPda);
    console.log("initDefaultLocation - 5");
    if(state.posX != 255) {
      return initLocation2(program, 'default', pos, 999);
    } else {
      return locationPda;
    }
  }
  catch(e){
    console.log("initDefaultLocation - 10");
    return DEFAULT_LOCATION;
  }
}

async function initLocation(program: Program<GotAMin>, location, name: string, position: [number, number], capacity: number) {
  return initLocation2(program, name, position, capacity);
}
async function initLocation2(program: Program<GotAMin>, name: string, position: [number, number], capacity: number): Promise<PublicKey> {
  const provider = program.provider as anchor.AnchorProvider;
  let pk = provider.wallet.publicKey;

  let locationPda = getLocationPda(program, pk, position);
  
  const pdaInfo = await provider.connection.getAccountInfo(locationPda);
  if(pdaInfo == null) {
    await program.methods
      .initLocation(name, position, new anchor.BN(capacity))
      .accounts({
        location: locationPda,
        owner: pk,
      })
      .rpc();
  }

  return locationPda;
}

async function initUnit(program: Program<GotAMin>, name: string, pos: [number, number]): Promise<PublicKey> {
  const provider = program.provider as anchor.AnchorProvider;
  let pk = provider.wallet.publicKey;

  let unitPda = getUnitPda(program, pk);
  let locationPda = getLocationPda(program, pk, pos);
  
  const pdaInfo = await provider.connection.getAccountInfo(unitPda);
  if(pdaInfo == null) {
    await program.methods
      .initUnit(name, pos)
      .accounts({
        unit: unitPda,
        location: locationPda,
        owner: pk,
      })
      .rpc();
  }

  return unitPda;
}

async function produce_without_input(program: Program<GotAMin>, producer, storage, resource) {
  const programProvider = program.provider as anchor.AnchorProvider;

  await program.methods
    .produceWithoutInput()
    .accounts({
      processor: producer.publicKey,
      storage: storage.publicKey,
      resource: resource.publicKey,
    })
    .rpc();

  return await program.account.storage.fetch(storage.publicKey);
}

async function produce_with_1_input(program: Program<GotAMin>, producer, storage, resourceToProduce, storageInput) {
  const programProvider = program.provider as anchor.AnchorProvider;

  await program.methods
    .produceWithOneInput()
    .accounts({
      processor: producer.publicKey,
      storage: storage.publicKey,
      resourceToProduce: resourceToProduce.publicKey,
      storageInput: storageInput.publicKey,      
    })
    .rpc();

  return await program.account.storage.fetch(storage.publicKey);
}

async function produce_with_2_inputs(program: Program<GotAMin>, producer, storage, resourceToProduce, storageInput1, storageInput2) {
  const programProvider = program.provider as anchor.AnchorProvider;

  await program.methods
    .produceWithTwoInputs()
    .accounts({
      processor: producer.publicKey,
      storage: storage.publicKey,
      resourceToProduce: resourceToProduce.publicKey,
      storageInput1: storageInput1.publicKey,
      storageInput2: storageInput2.publicKey,
    })
    .rpc();

  return await program.account.storage.fetch(storage.publicKey);
}

async function move_between_storage(program: Program<GotAMin>, storageFrom, storageTo, amount: number) {
  const programProvider = program.provider as anchor.AnchorProvider;

  await program.methods
    .moveBetweenStorage(new anchor.BN(amount))
    .accounts({
      storageFrom: storageFrom.publicKey,
      storageTo: storageTo.publicKey,
    })
    .rpc();
}

async function move_storage(program: Program<GotAMin>, storage, fromLocation, toLocation) {
  const programProvider = program.provider as anchor.AnchorProvider;

  await program.methods
    .moveStorage()
    .accounts({
      storage: storage.publicKey,
      fromLocation: fromLocation.publicKey,
      toLocation: toLocation.publicKey,
    })
    .rpc();
}

async function updateStorageMoveStatus(program: Program<GotAMin>, storage) {
  const programProvider = program.provider as anchor.AnchorProvider;

  await program.methods
    .updateStorageMoveStatus()
    .accounts({
      storage: storage.publicKey,
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
