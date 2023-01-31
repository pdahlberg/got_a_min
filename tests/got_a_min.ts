import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { assert, expect } from 'chai';
import { assertion, promise } from 'chai-as-promised';
import { AccountClient, AnchorError, parseIdlErrors, Program } from "@coral-xyz/anchor";
import { GotAMin } from "../target/types/got_a_min";
import { publicKey } from "@coral-xyz/anchor/dist/cjs/utils";
import { SystemAccountsCoder } from "@coral-xyz/anchor/dist/cjs/coder/system/accounts";

type KP = anchor.web3.Keypair;

var DEFAULT_FUEL_RES: ResourceState;
var DEFAULT_LOCATION: LocationState;
type MobilityType = {fixed:{}} | {movable:{}};
type ProcessorType = {producer:{}} | {sender:{}};
type FuelCostType = {nothing:{}} | {output:{}} | {distance:{}};

before("Init", async () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.GotAMin as Program<GotAMin>;
  //const programProvider = program.provider as anchor.AnchorProvider;

  DEFAULT_FUEL_RES = await initDefaultFuel(program);
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

function getLocationPda(program, pubKey: PublicKey, pos: [number, number]): PublicKey {
  let x = pos[0];
  let y = pos[1];
  return getPda(program, pubKey, "map-location", x, y);
}

function getPda(program, pubKey: PublicKey, key, x: number, y: number): PublicKey {
  let arrX = new Uint8Array(new anchor.BN(x).toArray('le', 8));
  let arrY = new Uint8Array(new anchor.BN(y).toArray('le', 8));

  const [pda, _] = PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode(key),
      pubKey.toBuffer(),
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
    const outputResource = await createResource2(program, "A", []);

    let result = await initProcessor(producer, DEFAULT_FUEL_RES, outputResource, 1);
    
    expect(result.owner.toBase58()).to.equal(provider.wallet.publicKey.toBase58());
    expect(result.outputRate.toNumber()).to.equal(1);
    //expect(result.resourceId.toBase58()).to.equal(outputResource.getPubKeyStr());
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
    const outputResource = await createResource2(program, "A", []);

    let result = await initProcessor(producer, DEFAULT_FUEL_RES, outputResource.getPubKey(), 1);
    
    expect(result.owner.toBase58()).to.equal(programProvider.wallet.publicKey.toBase58());
    expect(result.outputRate.toNumber()).to.equal(1);
    //expect(result.resourceId.toBase58()).to.equal(outputResource.getPubKeyStr());
  });

  it("Produce 1 of resource A #prod1A", async () => {
    let prodRate = 1;
    let duration = 1;
    let resource = await createResource2(program, 'A', []);
    let producer = await (await createProcessor3(resource, prodRate, duration)).withName("Producer");
    let storage = await (await createStorage4(program, resource, 999)).withName("Storage");
    
    for(let num = 0; num < 5; num += 1) {
      await debug_produce_without_input(producer, storage, resource, num);
      (await producer.refresh()).log(num);
      (await storage.refresh()).log(num);
    }

    (await storage.refresh()).log();
    expect(storage.amount, "storage amount").to.equal(4);
  });

  it("Produce 2 of resource A and Storage below full capacity", async () => {
    let prodRate = 5;
    let duration = 1;
    let resource = await createResource2(program, 'A', []);
    let producer = await (await createProcessor3(resource, prodRate, duration)).withName("Producer");
    let storage = await (await createStorage4(program, resource, 3)).withName("Storage");

    await debug_produce_without_input(producer, storage, resource, 1);

    await producer.refresh();
    await storage.refresh();
    expect(producer.awaitingUnits, "producer awaiting").to.equal(2);
    expect(storage.amount, "storage amount").to.equal(3);
  });

  it("Produce 1 resource B from 2 A #prod1BFrom2A", async () => {
    let rate = 1;
    let duration = 1;
    let resourceA = await createResource2(program, 'A', []);
    let resourceB = await createResource2(program, 'B', [[resourceA, 2]]);
    let storageA = await (await createStorage4(program, resourceA, 5)).withName("StorageA");
    let storageB = await (await createStorage4(program, resourceB, 5)).withName("StorageB");
    let storageFuel = await createStorage3(program, DEFAULT_FUEL_RES.keyPair, 10, DEFAULT_LOCATION);
    let producer = await (await createProcessor3(resourceB, rate, duration)).withName("Prod[2A=>B]");

    await debugStorage(storageA, 5);
    await storageA.refresh();
    expect(storageA.amount).to.equal(5);

    await debug_produce_with_1_input(producer, storageB, resourceB, storageA, storageFuel, 1);
    
    await (await producer.refresh()).log();
    await (await storageA.refresh()).log();
    await (await storageB.refresh()).log();
    expect(storageB.amount, "Storage B amount").to.equal(1);
    expect(storageA.amount, "Storage A amount").to.equal(3);    
  });

  it("Produce 1 resource B from 2 A from a different location fails", async () => {
    let producerBProdRate = 1;
    let locationA = await createLocation2(program, 'locA', [0, 0], 10);
    let [resourceA, _1] = await createResource(program, 'A', []);
    let [producerA, _2] = await createProcessor(program, resourceA, 5, 1);
    let storageA = await createStorage3(program, resourceA, 5, locationA);
    let locationB = await createLocation2(program, 'locB', [50, 0], 10);
    let [resourceB, _4] = await createResource(program, 'B', [[resourceA, 2]]);
    let [producerB, _5] = await createProcessor(program, resourceB, producerBProdRate, 5, locationB);
    let storageB = await createStorage3(program, resourceB, 5, locationB);    
    let storageFuel = await createStorage3(program, DEFAULT_FUEL_RES.keyPair, 10, locationA);

    try {
      await produce_with_1_input(producerB, storageB, resourceB, storageA, storageFuel);
    
      assert(false, "Expected to fail");
    } catch(e) {
      assertAnchorError(e, "DifferentLocations");
    }
  });

  it("Produce resource B with input A fails when A is empty", async () => {
    let location = await createLocation2(program, 'locA', [0, 0], 10); // Why is DEFAULT_LOCATION not working?
    let [resourceA, _1] = await createResource(program, 'A', []);
    let storageA = await createStorage3(program, resourceA, 1, location);
    let [resourceB, _3] = await createResource(program, 'B', [[resourceA, 1]]);
    let [producerB, _4] = await createProcessor(program, resourceB, 2, 1, location);
    let storageB = await createStorage3(program, resourceB, 1, location);
    let storageFuel = await createStorage3(program, DEFAULT_FUEL_RES.keyPair, 10, location);

    // await expect(stuff(program, producerB, resourceB, resourceA)).should.be.rejectedWith("I AM THE EXPECTED ERROR");
    try {
      await produce_with_1_input(producerB, storageB, resourceB, storageA, storageFuel);
      
      assert(false, "Expected to fail");
    } catch(e) {
      assertAnchorError(e, "InputStorageAmountTooLow");
    }
  });

  it("Produce 1 resource C from 1 A + 1 B", async () => {
    let location = await createLocation2(program, 'locA', [0, 0], 10); // Why is DEFAULT_LOCATION not working?
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
    const fuelRes = await createResource2(program, "fuel", []);
    const outputRes = await createResource2(program, "A", []);

    let result = await initProcessor(sender, fuelRes, outputRes.getPubKey(), 1, 1, DEFAULT_LOCATION, {sender:{}});
    
    expect(result.owner.toBase58()).to.equal(programProvider.wallet.publicKey.toBase58());
    expect(JSON.stringify(result.processorType)).to.equal(JSON.stringify({sender:{}}));
  });

  it("Send 1 resource A #send1A", async () => {
    let location1 = await createLocation2(program, 'loc1', [1, 0], 9999);
    let location2 = await createLocation2(program, 'loc2', [12, 3], 9999);
    let resource = await createResource2(program, 'A', []);
    let sender = await (await createProcessor3(resource, 5, 6, location1, {sender:{}}, {distance:{}}))
      .withName("Sender");
    let localStorage = (await createStorage3(program, resource.keyPair, 100, location1))
      .withName("local_storage")
      .log();
    let remoteStorage = (await createStorage3(program, resource.keyPair, 100, location2))
      .withName("remote_storage")
      .log();
    let fuelStorage = await (await createStorage3(program, DEFAULT_FUEL_RES.keyPair, 10, location1))
      .withName("fuel_storage");

    await debugStorage(fuelStorage, 2000);

    await debugStorage(localStorage, 10);
    (await sender.refresh()).log();
    (await localStorage.refresh()).log();
    (await remoteStorage.refresh()).log();
    (await fuelStorage.refresh()).log();

    console.log("Send");

    for(let num = 0; num < 11; num += 10) {
      await debug_send(sender, remoteStorage, resource, localStorage, fuelStorage, num, location1, location2);
      (await sender.refresh()).log(num);
      (await localStorage.refresh()).log(num);
      (await remoteStorage.refresh()).log(num);
      (await fuelStorage.refresh()).log(num);
    }

    expect(remoteStorage.amount, "remote storage").to.equal(5);
    expect(localStorage.amount, "local storage").equal(0);
  });
});

describe("/Transportation", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.GotAMin as Program<GotAMin>;
  const programProvider = program.provider as anchor.AnchorProvider;

  it("Move movable Storage", async () => {
    let [resource, _1] = await createResource(program, 'A', []);
    let location1 = await createLocation2(program, 'loc1', [0, 0], 10);
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
    let location1 = await createLocation2(program, 'loc1', [0, 0], 10);
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
    let locationA = await createLocation2(program, 'locA', [0, 0], 10);
    let [producerA, _2] = await createProcessor(program, resource, 10, 0, locationA);
    let storageAFrom = await createStorage3(program, resource, 10, locationA);
    let locationB = await createLocation2(program, 'locB', [1, 0], 10);
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
    let location = await createLocation2(program, 'locA', [0, 0], 10);
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
    let location1 = await createLocation2(program, 'loc1', [0, 0], 10);
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
    let location1 = await createLocation2(program, 'loc1', [0, 0], 10);
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
    let location1 = await createLocation2(program, 'loc1', [0, 0], 10);
    let storage = await createStorage3(program, resource, 10, location1, {movable:{}});
    let location2 = await createLocation2(program, 'loc2', [1, 0], 10);

    await move_storage(program, storage, location1, location2);
    await storage.refresh();
    await location1.refresh();
    await location2.refresh();

    expect(storage.locationId.toBase58()).equal(location2.getPubKeyStr());
    expect(location1.occupiedSpace).equal(0);
    expect(location2.occupiedSpace).equal(1);
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

async function createResource2(program: Program<GotAMin>, name: string, inputs):  Promise<ResourceState> {
  const resourceKey: anchor.web3.Keypair = anchor.web3.Keypair.generate();
  await initResource(program, resourceKey, name, inputs);
  return new ResourceState(program, resourceKey).refresh();
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

async function createProcessor(program: Program<GotAMin>, output_resource, outputRate, processingDuration = 5, location = DEFAULT_LOCATION, type: ProcessorType = {producer:{}}, fuel_resource = DEFAULT_FUEL_RES, fuelCostType: FuelCostType = {nothing:{}}): Promise<[KP, any]> {
  const processor = anchor.web3.Keypair.generate();
  return [processor, await initProcessor(processor, fuel_resource, output_resource, outputRate, processingDuration, location, type, fuelCostType)];
}

async function createProcessor2(program: Program<GotAMin>, output_resource, outputRate, processingDuration = 5, location = DEFAULT_LOCATION, type: ProcessorType = {producer:{}}, fuel_resource = DEFAULT_FUEL_RES, fuelCostType: FuelCostType = {nothing:{}}): Promise<KP> {
  const processor = anchor.web3.Keypair.generate();
  await initProcessor(processor, fuel_resource, output_resource, outputRate, processingDuration, location, type, fuelCostType);
  return processor;
}

async function createProcessor3(output_resource: ResourceState, outputRate, processingDuration = 5, location: LocationState = DEFAULT_LOCATION, type: ProcessorType = {producer:{}}, fuelCostType: FuelCostType = {nothing:{}}, fuel_resource = DEFAULT_FUEL_RES): Promise<ProcessorState> {
  let program = output_resource.program;
  const keyPair = anchor.web3.Keypair.generate();
  await initProcessor(keyPair, fuel_resource, output_resource, outputRate, processingDuration, location, type, fuelCostType);
  return new ProcessorState(program, keyPair).refresh();
}

async function initProcessor(processor, fuelResource: ResourceState, outputResource, outputRate, processingDuration = 5, location = DEFAULT_LOCATION, type: ProcessorType = {producer:{}}, fuelCostType: FuelCostType = {nothing:{}}) {
  let program = fuelResource.program;
  assert(outputRate > 0, 'initProcessor requirement: outputRate > 0');
  assert(processingDuration > 0, 'initProcessor requirement: processingDuration > 0');
  const programProvider = program.provider as anchor.AnchorProvider;
  const outputRateBN = new anchor.BN(outputRate);
  const processingDurationBN = new anchor.BN(processingDuration);
  const current_timestamp = new anchor.BN(0);

  await program.methods
    .debugInitProcessor(
      type,
      fuelResource.getPubKey(),
      outputResource.publicKey,
      outputRateBN,
      processingDurationBN,
      fuelCostType,
      current_timestamp,
    )
    .accounts({
      processor: processor.publicKey,
      location: location.getPubKey(),
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
  location: LocationState = DEFAULT_LOCATION, 
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
  location: LocationState = DEFAULT_LOCATION, 
  mobilityType: MobilityType = {fixed:{}}, 
  speed: number = 1,
) {
  const programProvider = program.provider as anchor.AnchorProvider;

  await program.methods
    .initStorage(resource.publicKey, new anchor.BN(capacity), mobilityType, new anchor.BN(speed), location.xBN, location.yBN)
    .accounts({
      storage: storage.publicKey,
      location: location.getPubKey(),
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
  location: LocationState = DEFAULT_LOCATION, 
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
  location: LocationState = DEFAULT_LOCATION, 
  mobilityType: MobilityType = {fixed:{}}, 
  speed: number = 1,
  instanceName: string = null,
): Promise<StorageState> {
  let [keyPair, b] = await createStorage(program, resource, capacity, location, mobilityType, speed);
  let state = new StorageState(program, keyPair, instanceName);
  return await state.refresh();
}

async function createStorage4(
  program: Program<GotAMin>,
  resource: ResourceState, 
  capacity: number, 
  location: LocationState = DEFAULT_LOCATION, 
  mobilityType: MobilityType = {fixed:{}}, 
  speed: number = 1,
  instanceName: string = null,
): Promise<StorageState> {
  let [keyPair, b] = await createStorage(program, resource.keyPair, capacity, location, mobilityType, speed);
  let state = new StorageState(program, keyPair, instanceName);
  return await state.refresh();
}

class BaseState<T> {
  readonly program: Program<GotAMin>;
  readonly keyPair: KP;
  readonly publicKey: anchor.web3.PublicKey;
  instanceName: string;

  constructor(program: Program<GotAMin>, keyPair: KP, instanceName: string, publicKey: PublicKey = null) {
    this.program = program;
    this.keyPair = keyPair;
    this.publicKey = keyPair?.publicKey ?? publicKey;
    this.instanceName = instanceName;
  }

  getPubKey(): PublicKey {
    return this.publicKey;
  }

  getPubKeyStr(): string {
    return this.getPubKey().toBase58();
  }

  toString(): string {
    return `${this.instanceName}()`;
  }

  log(prefix: number = null): this {
    let str = (prefix == null ? ">" : ": ");
    console.log(str, this.toString());
    return this;
  }

  withName(instanceName: string): this {
    this.instanceName = instanceName;
    return this;
  }
}

class LocationState extends BaseState<LocationState> {

  x: number;
  xBN: anchor.BN;
  y: number;
  yBN: anchor.BN;
  occupiedSpace: number;

  public static async createPda(program: Program<GotAMin>, publicKey: PublicKey, instanceName: string): Promise<LocationState> {
    return new LocationState(program, null, instanceName, publicKey)
      .refresh();
  }

  async refresh(): Promise<LocationState> {
    let state = await this.program.account.location.fetch(this.getPubKey());
    this.x = state.posX.toNumber();
    this.xBN = state.posX;
    this.y = state.posY.toNumber();
    this.yBN = state.posY;
    this.occupiedSpace = state.occupiedSpace.toNumber();
    return this;
  }

}

class ProcessorState extends BaseState<ProcessorState> {

  claimedAt: number;
  claimLocalBase: number = 0;
  awaitingUnits: number;

  constructor(program: Program<GotAMin>, keyPair: KP, instanceName: string = "Processor") {
    super(program, keyPair, instanceName);
  }

  async refresh(): Promise<ProcessorState> {
    let state = await this.program.account.processor.fetch(this.getPubKey());
    this.claimedAt = state.claimedAt.toNumber();
    this.awaitingUnits = state.awaitingUnits.toNumber();
    return this;
  }

  toString(): string {
    let relativeClaim = this.claimedAt - this.claimLocalBase;
    return `${this.instanceName}(claimedAt=${relativeClaim}, await=${this.awaitingUnits})`;
  }

  resetClaimBase(): ProcessorState {
    this.claimLocalBase = this.claimedAt;
    return this;
  }

}

class ResourceState extends BaseState<ResourceState> {
  name: string;

  constructor(program: Program<GotAMin>, keyPair: KP, instanceName: string = "Resource") {
    super(program, keyPair, instanceName);
  }

  async refresh(): Promise<ResourceState> {
    let state = await this.program.account.resource.fetch(this.getPubKey());
    this.name = state.name;
    return this;
  }

}

class StorageState extends BaseState<StorageState> {
  amount: number;
  arrivesAt: number;
  locationId: PublicKey;

  constructor(program: Program<GotAMin>, keyPair: KP, instanceName: string = "Storage") {
    super(program, keyPair, instanceName);
  }

  async refresh(): Promise<StorageState> {
    let state = await this.program.account.storage.fetch(this.getPubKey());
    this.amount = state.amount.toNumber();
    this.arrivesAt = state.arrivesAt.toNumber();
    this.locationId = state.locationId;
    return this;
  }

  toString(): string {
    return `${this.instanceName}(amnt=${this.amount})`;
  }

}

class UnitState extends BaseState<UnitState> {
  constructor(program: Program<GotAMin>, keyPair: KP, instanceName: string = "Unit") {
    super(program, keyPair, instanceName);
  }

  async refresh(): Promise<UnitState> {
    let state = await this.program.account.unit.fetch(this.getPubKey());
    return this;
  }

}

async function initStorage(
  program: Program<GotAMin>, 
  storage: KP, 
  resource: KP, 
  capacity: number, 
  location: LocationState = DEFAULT_LOCATION, 
  mobilityType: MobilityType = {fixed:{}}, 
  speed: number = 1,
) {
  const provider = program.provider as anchor.AnchorProvider;

  await program.methods
    .initStorage(resource.publicKey, new anchor.BN(capacity), mobilityType, new anchor.BN(speed), location.xBN, location.yBN)
    .accounts({
      storage: storage.publicKey,
      location: location.getPubKey(),
      owner: provider.wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([storage])
    .rpc();
    
  return await program.account.storage.fetch(storage.publicKey);
}

async function debugStorage(
  storage: StorageState, 
  amount: number = 1,
) {
  let program = storage.program;

  await program.methods
    .debugSetStorageAmount(new anchor.BN(amount))
    .accounts({
      storage: storage.getPubKey(),
    })
    .rpc();    
}

async function initDefaultFuel(program: Program<GotAMin>): Promise<ResourceState> {
  return await createResource2(program, "default_fuel", []);
}

async function createLocation(program: Program<GotAMin>, name: string, position: [number, number], capacity: number):  Promise<PublicKey> {
  return await initLocation2(program, name, position, capacity);
}

async function createLocation2(program: Program<GotAMin>, name: string, position: [number, number], capacity: number):  Promise<LocationState> {
  let publicKey = await initLocation2(program, name, position, capacity);
  return LocationState.createPda(program, publicKey, `Loc(${position[0]/position[1]})`);
}

async function initDefaultLocation(program: Program<GotAMin>): Promise<LocationState> {
  return await createLocation2(program, "default", [9999, 9999], 999);
}

async function initLocation2(program: Program<GotAMin>, name: string, position: [number, number], capacity: number, locationType = null): Promise<PublicKey> {
  const provider = program.provider as anchor.AnchorProvider;
  let pubKey = provider.wallet.publicKey;

  let x = position[0];
  let y = position[1];
  let locationPda = getLocationPda(program, pubKey, position);
  
  const pdaInfo = await provider.connection.getAccountInfo(locationPda);
  if(pdaInfo == null) {
    await program.methods
      .initLocation(name, new anchor.BN(x), new anchor.BN(y), new anchor.BN(capacity), locationType)
      .accounts({
        location: locationPda,
        owner: pubKey,
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

async function produce_without_input2(producer: ProcessorState, storage: StorageState, resource: ResourceState) {
  await produce_without_input(producer.keyPair, storage, resource.keyPair);
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

async function debug_produce_without_input(producer: ProcessorState, storage: StorageState, resource: ResourceState, current_timestamp: number) {
  let program = storage.program;
  const programProvider = program.provider as anchor.AnchorProvider;

  await program.methods
    .debugProduceWithoutInput(new anchor.BN(current_timestamp))
    .accounts({
      processor: producer.getPubKey(),
      storage: storage.getPubKey(),
      resource: resource.getPubKey(),
    })
    .rpc();
}

async function produce_with_1_input2(processor: ProcessorState, storage: StorageState, resourceToProduce: ResourceState, storageInput: StorageState, storageFuel: StorageState) {
  return await produce_with_1_input(processor.keyPair, storage, resourceToProduce.keyPair, storageInput, storageFuel);
}

async function produce_with_1_input(producer, storage: StorageState, resourceToProduce, storageInput: StorageState, storageFuel: StorageState) {
  let program = storage.program;
  const programProvider = program.provider as anchor.AnchorProvider;

  await program.methods
    .produceWithOneInput()
    .accounts({
      processor: producer.publicKey,
      storage: storage.getPubKey(),
      resourceToProduce: resourceToProduce.publicKey,
      storageInput: storageInput.getPubKey(),
      storageFuel: storageFuel.getPubKey(),
    })
    .rpc();
}

async function debug_produce_with_1_input(producer: ProcessorState, storage: StorageState, resourceToProduce: ResourceState, storageInput: StorageState, storageFuel: StorageState, current_timestamp: number) {
  let program = storage.program;
  const programProvider = program.provider as anchor.AnchorProvider;

  await program.methods
    .debugProduceWithOneInput(new anchor.BN(current_timestamp))
    .accounts({
      processor: producer.getPubKey(),
      storage: storage.getPubKey(),
      resourceToProduce: resourceToProduce.getPubKey(),
      storageInput: storageInput.getPubKey(),
      storageFuel: storageFuel.getPubKey(),
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

async function debug_produce_with_2_inputs(producer, storage: StorageState, resourceToProduce, storageInput1: StorageState, storageInput2: StorageState, current_timestamp: number) {
  let program = storage.program;
  const programProvider = program.provider as anchor.AnchorProvider;

  await program.methods
    .debugProduceWithTwoInputs(new anchor.BN(current_timestamp))
    .accounts({
      processor: producer.publicKey,
      storage: storage.getPubKey(),
      resourceToProduce: resourceToProduce.publicKey,
      storageInput1: storageInput1.getPubKey(),
      storageInput2: storageInput2.getPubKey(),
    })
    .rpc();
}

async function send(sender: ProcessorState, toStorage: StorageState, resourceToProduce: ResourceState, fromStorage: StorageState, storageFuel: StorageState, from: LocationState, to: LocationState) {
  let program = sender.program;
  const programProvider = program.provider as anchor.AnchorProvider;

  await program.methods
    .send(null, from.xBN, from.yBN, to.xBN, to.yBN)
    .accounts({
      processor: sender.getPubKey(),
      storage: toStorage.getPubKey(),
      resourceToProduce: resourceToProduce.getPubKey(),
      storageInput: fromStorage.getPubKey(),
      storageFuel: storageFuel.getPubKey(),
    })
    .rpc();
}

async function debug_send(sender: ProcessorState, toStorage: StorageState, resourceToProduce: ResourceState, fromStorage: StorageState, storageFuel: StorageState, current_timestamp: number, from: LocationState, to: LocationState) {
  let program = sender.program;

  await program.methods
    .debugSend(new anchor.BN(999), new anchor.BN(current_timestamp), from.xBN, from.yBN, to.xBN, to.yBN)
    .accounts({
      processor: sender.getPubKey(),
      storage: toStorage.getPubKey(),
      resourceToProduce: resourceToProduce.getPubKey(),
      storageInput: fromStorage.getPubKey(),
      storageFuel: storageFuel.getPubKey(),
      fromLocation: from.getPubKey(),
      toLocation: to.getPubKey(),
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
