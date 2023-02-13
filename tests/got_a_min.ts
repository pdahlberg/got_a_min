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

function getLocationPda(program, pubKey: PublicKey, pos: [number, number]): PublicKey {
  let x = pos[0];
  let y = pos[1];
  return getPda(program, pubKey, "map-location", x, y);
}

function getPda(program, pubKey: PublicKey, key: string, x: number, y: number): PublicKey {
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

async function fetchLocationStatePK(program, pos: PublicKey): Promise<LocationState> {
  return (await LocationState.createPda(program, pos, "Location")).refresh();
}

describe("/Sandbox", () => {
  let provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.GotAMin as Program<GotAMin>;
  const programProvider = program.provider as anchor.AnchorProvider;

  it("Init stuff #init_stuff", async () => {
    let stuff = await initStuff(program, 1);

    let state = await program.account.stuff.fetch(stuff);
    expect(state.x.toString()).equal("1");
  });
});

function getStuffPda(program, pubKey: PublicKey, key: string, x: number): PublicKey {
  let arrX = new Uint8Array(new anchor.BN(x).toArray('le', 8));

  const [pda, _] = PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode(key),
      pubKey.toBuffer(),
      arrX,
    ],
    program.programId,
  );
  return pda;
}

async function initStuff(program: Program<GotAMin>, x: number): Promise<PublicKey> {
  const provider = program.provider as anchor.AnchorProvider;
  let pubKey = provider.wallet.publicKey;

  let pda = getStuffPda(program, pubKey, "stuff", x);
  
  const pdaInfo = await provider.connection.getAccountInfo(pda);
  console.log("pda", pdaInfo);
  if(pdaInfo == null) {
    await program.methods
      .debugInitStuff(new anchor.BN(x))
      .accounts({
        stuff: pda,
        owner: pubKey,
      })
      .rpc();
  }

  return pda;
}

describe("/Map", () => {
  let provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.GotAMin as Program<GotAMin>;
  const programProvider = program.provider as anchor.AnchorProvider;

  it("Init map", async () => {
    let map = await initMap(program);

    (await map.refresh()).log();
    
    expect(map.initialized).equal(true);
  });

  it("Update map", async () => {
    let map = await initMap(program);

    (await map.refresh()).log();

    await map.put(0, 0, 9);
    await map.put(6, 0, 9);
    await map.put(0, 4, 9);
    await map.put(6, 4, 9);

    (await map.refresh()).log();
    console.log(map.csm.debugCompressedAsString());
    expect(map.get(0, 0)).equal(9);
    expect(map.get(6, 0)).equal(9);
    expect(map.get(0, 4)).equal(9);
    expect(map.get(6, 4)).equal(9);
  });

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
    
    expect(state.x).equal(99);
    expect(state.y).equal(99);
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

  /*it("Init unit", async () => {
    const p1: KP = anchor.web3.Keypair.generate();
    let pk = provider.wallet.publicKey;
    let startPos: [number, number] = [1, 1];
    let startLocationPda = await initLocation2(program, "loc1", startPos, 10, {space:{}});
    let unitName = "s1";

    await initUnit(unitName, startPos);
    let unitBeforeMove = await fetchUnitState(program, pk, unitName);

    expect(unitBeforeMove.name).equal(unitName)
    expect(unitBeforeMove.atLocationId.toBase58()).equal(startLocationPda.toBase58(), "Start location")
  });*/


});

describe("/Unit", () => {
  let provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.GotAMin as Program<GotAMin>;
  const programProvider = program.provider as anchor.AnchorProvider;
  
  it("Init and move unit", async () => {
    const p1: KP = anchor.web3.Keypair.generate();
    let pk = provider.wallet.publicKey;
    let unitName = "Shp1";
    let locationFrom = await (await createLocation2(program, "L1", [1, 1], 10, {space:{}})).withName("From");
    let locationTo = await (await createLocation2(program, "L2", [2, 1], 10)).withName("To");
    let unit = await initUnit(unitName, locationFrom);
    let map = await initMap(program);
    //await map.put(0, 0, 9);

    (await map.refresh()).log();
    (await locationTo.refresh()).log();

    unit.log();
    expect(unit.name).equal(unitName)

    await moveUnitStart(unit, locationTo, 0);
    await moveUnitComplete(unit, locationTo, map, 1000);

    (await unit.refresh()).log();
    (await locationTo.refresh()).log();
    (await map.refresh()).log();
    
    expect(unit.atLocation.toBase58()).equal(locationTo.getPubKeyStr(), "Target location")
    expect(locationTo.typeAsJson()).equal(JSON.stringify({space:{}}));
  });

  /*it("Move and explore", async () => {
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
  });*/

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
    let storage = await (await createStorage4(resource, 999)).withName("Storage");
    
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
    let storage = await (await createStorage4(resource, 3)).withName("Storage");

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
    let storageA = await (await createStorage4(resourceA, 5)).withName("StorageA");
    let storageB = await (await createStorage4(resourceB, 5)).withName("StorageB");
    let storageFuel = await createStorage4(DEFAULT_FUEL_RES, 10, DEFAULT_LOCATION);
    let producer = await (await createProcessor3(resourceB, rate, duration)).withName("Prod[2A=>B]");

    await debugStorage(storageA, 5);
    await storageA.refresh();
    expect(storageA.amount).to.equal(5);

    let time = 0;
    await (await producer.refresh()).log(time);
    await (await storageA.refresh()).log(time);
    await (await storageB.refresh()).log(time);

    time = 3;
    await debug_produce_with_1_input(producer, storageB, resourceB, storageA, storageFuel, time);
    
    await (await producer.refresh()).log(time);
    await (await storageA.refresh()).log(time);
    await (await storageB.refresh()).log(time);
    expect(storageB.amount, "Storage B amount").to.equal(2);
    expect(storageA.amount, "Storage A amount").to.equal(1);    
  });

  it("Produce 1 resource B from 2 A from a different location fails", async () => {
    let producerBProdRate = 1;
    let locationA = await createLocation2(program, 'locA', [0, 0], 10);
    let resourceA = await createResource2(program, 'A', []);
    let [producerA, _2] = await createProcessor(program, resourceA, 5, 1);
    let storageA = await createStorage4(resourceA, 5, locationA);
    let locationB = await createLocation2(program, 'locB', [50, 0], 10);
    let resourceB = await createResource2(program, 'B', [[resourceA, 2]]);
    let [producerB, _5] = await createProcessor(program, resourceB, producerBProdRate, 5, locationB);
    let storageB = await createStorage4(resourceB, 5, locationB);    
    let storageFuel = await createStorage4(DEFAULT_FUEL_RES, 10, locationA);

    try {
      await produce_with_1_input(producerB, storageB, resourceB, storageA, storageFuel);
    
      assert(false, "Expected to fail");
    } catch(e) {
      assertAnchorError(e, "DifferentLocations");
    }
  });

  it("Produce resource B with input A gets no output when A is empty #noProdBFromA", async () => {
    let location = await createLocation2(program, 'locA', [0, 0], 10); // Why is DEFAULT_LOCATION not working?
    let resourceA = await createResource2(program, 'A', []);
    let resourceB = await createResource2(program, 'B', [[resourceA, 1]]);
    let storageIn = await createStorage4(resourceA, 1, location);
    let storageOut = await createStorage4(resourceB, 1, location);
    let storageFuel = await createStorage4(DEFAULT_FUEL_RES, 10, location);
    let producer = await createProcessor3(resourceB, 2, 1, location);

    await debug_produce_with_1_input(producer, storageOut, resourceB, storageIn, storageFuel, 1);
      
    expect(storageOut.amount).equal(0);
  });

  it("Produce 1 resource C from 1 A + 1 B #prod1CFrom1A1B", async () => {
    let rate = 1;
    let duration = 1;
    let resourceA = await createResource2(program, 'A', []);
    let resourceB = await createResource2(program, 'B', []);
    let resourceC = await createResource2(program, 'C', [[resourceA, 1], [resourceB, 1]]);
    let storageA = (await createStorage4(resourceA, 5)).withName("StorageA");
    let storageB = (await createStorage4(resourceB, 5)).withName("StorageB");
    let storageC = (await createStorage4(resourceC, 5)).withName("StorageC");
    let producer = (await createProcessor3(resourceC, rate, duration)).withName("Prod[A+B=>C]");

    let time = 0;
    await debugStorage(storageA, 5);
    await debugStorage(storageB, 5);

    await (await producer.refresh()).log(time);
    await (await storageA.refresh()).log(time);
    await (await storageB.refresh()).log(time);
    await (await storageC.refresh()).log(time);

    time = 2;
    await debug_produce_with_2_inputs(producer, storageC, resourceC, storageA, storageB, time);
    
    await (await producer.refresh()).log(time);
    await (await storageA.refresh()).log(time);
    await (await storageB.refresh()).log(time);
    await (await storageC.refresh()).log(time);

    expect(storageA.amount).equal(3);
    expect(storageB.amount).equal(3);
    expect(storageC.amount).equal(2);
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
    let localStorage = (await createStorage4(resource, 100, location1))
      .withName("local_storage")
      .log();
    let remoteStorage = (await createStorage4(resource, 100, location2))
      .withName("remote_storage")
      .log();
    let fuelStorage = await (await createStorage4(DEFAULT_FUEL_RES, 10, location1))
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
    let resource = await createResource2(program, 'A', []);
    let location1 = await createLocation2(program, 'loc1', [0, 0], 10);
    let storage = await createStorage4(resource, 10, location1, {movable:{}}, 2);
    let location2 = await createLocation2(program, 'loc2', [2, 0], 10);

    await debugMoveStorage(storage, location1, location2, 1);

    await storage.refresh();
    expect(storage.locationId.toBase58()).to.equal(location2.getPubKeyStr());
    expect(storage.arrivesAt).to.greaterThan(0);

    await updateStorageMoveStatus(storage);

    await storage.refresh();
    expect(storage.locationId.toBase58()).to.equal(location2.getPubKeyStr());
    expect(storage.arrivesAt).to.equal(0);
  });

  it("Add to Storage while moving should fail", async () => {
    let resource = await createResource2(program, 'A', []);
    let location1 = await createLocation2(program, 'loc1', [0, 0], 10);
    let producer = await createProcessor3(resource, 10, 1, location1);
    let storage = await createStorage4(resource, 10, location1, {movable:{}});
    let location2 = await createLocation2(program, 'loc2', [10, 0], 10);
    await debugMoveStorage(storage, location1, location2, 1);
  
    try {
      await debug_produce_without_input(producer, storage, resource, 1);

      assert(false, "Expected to fail");
    } catch(e) {
      assertAnchorError(e, "DifferentLocations");
    }

    await storage.refresh();
    expect(storage.locationId.toBase58()).to.equal(location2.getPubKeyStr());
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
    let resource = await createResource2(program, 'A', []);
    let [producer, _2] = await createProcessor(program, resource, 10, 1);
    let storageFrom = await createStorage4(resource, 10);
    let storageTo = await createStorage4(resource, 3);
    await produce_without_input(producer, storageFrom, resource);

    try {
      await move_between_storage(storageFrom, storageTo, 5);

      assert(false, "Expected to fail");
    } catch(e) {
      assertAnchorError(e, "StorageFull");
    }
  });

  it("Storage with amount too low", async () => {
    let resource = await createResource2(program, 'A', []);
    let [producer, _2] = await createProcessor(program, resource, 10, 1);
    let storageFrom = await createStorage4(resource, 10);
    let storageTo = await createStorage4(resource, 100);
    await produce_without_input(producer, storageFrom, resource);

    try {
      await move_between_storage(storageFrom, storageTo, 25);

      assert(false, "Expected to fail");
    } catch(e) {
      assertAnchorError(e, "StorageAmountTooLow");
    }
  });
    
  it("Move between Storage with different resources #storeMoveNotMatching", async () => {
    let resourceA = await createResource2(program, 'A', []);
    let resourceB = await createResource2(program, 'B', []);
    let storageAFrom = await createStorage4(resourceA, 1);
    let storageBTo = await createStorage4(resourceB, 1);

    await debugStorage(storageAFrom, 1);

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

  it("Move between Storage in different locations", async () => {
    let resource = await createResource2(program, 'A', []);
    let locationA = await createLocation2(program, 'locA', [0, 0], 10);
    let storageAFrom = await createStorage4(resource, 10, locationA);
    let locationB = await createLocation2(program, 'locB', [1, 0], 10);
    let storageBTo = await createStorage4(resource, 100, locationB);
    await debugStorage(storageAFrom, 10);

    try {
      await move_between_storage(storageAFrom, storageBTo, 1);

      assert(false, "Expected to fail");
    } catch(e) {
      assertAnchorError(e, "DifferentLocations");
    }
  });

  it("Producer and Storage in different locations", async () => {
    let resource = await createResource2(program, 'A', []);
    let location = await createLocation2(program, 'locA', [0, 0], 10);
    let producer = await createProcessor3(resource, 10, 1);
    let storage = await createStorage4(resource, 10, location);

    try {
      await produce_without_input(producer, storage, resource);

      assert(false, "Expected to fail");
    } catch(e) {
      assertAnchorError(e, "DifferentLocations");
    }
  });  

  it("Move static Storage fails", async () => {
    let resource = await createResource2(program, 'A', []);
    let location1 = await createLocation2(program, 'loc1', [0, 0], 10);
    let storage = await createStorage4(resource, 10, location1);
    let location2 = await createLocation2(program, 'loc2', [1, 0], 10);

    try {
      await debugMoveStorage(storage, location1, location2, 1);

      assert(false, "Expected to fail");
    } catch(e) {
      assertAnchorError(e, "StorageTypeNotMovable");
    }
  });  

  it("Move Storage to full Location fails", async () => {
    let resource = await createResource2(program, 'A', []);
    let location1 = await createLocation2(program, 'loc1', [60, 0], 10);
    let storage = await createStorage4(resource, 10, location1, {movable:{}});
    let location2 = await createLocation2(program, 'loc2', [61, 0], 0);

    try {
      await debugMoveStorage(storage, location1, location2, 1);

      assert(false, "Expected to fail");
    } catch(e) {
      assertAnchorError(e, "LocationFull");
    }
  });

  it("Move Storage to new Location", async () => {
    let resource = await createResource2(program, 'A', []);
    let location1 = await createLocation2(program, 'loc1', [50, 0], 10);
    let storage = await createStorage4(resource, 10, location1, {movable:{}});
    let location2 = await createLocation2(program, 'loc2', [51, 0], 10);

    await debugMoveStorage(storage, location1, location2, 1);
    await storage.refresh();
    await location1.refresh();
    await location2.refresh();

    expect(storage.locationId.toBase58()).equal(location2.getPubKeyStr());
    expect(location1.occupiedSpace).equal(0);
    expect(location2.occupiedSpace).equal(1);
  });  

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

async function createStorage4(
  resource: ResourceState, 
  capacity: number, 
  location: LocationState = DEFAULT_LOCATION, 
  mobilityType: MobilityType = {fixed:{}}, 
  speed: number = 1,
  instanceName: string = null,
): Promise<StorageState> {
  let [keyPair, b] = await createStorage(resource.program, resource.keyPair, capacity, location, mobilityType, speed);
  let state = new StorageState(keyPair, resource, instanceName);
  return await state.refresh();
}

class BaseState<T> {
  readonly program: Program<GotAMin>;
  readonly keyPair: KP;
  readonly publicKey: anchor.web3.PublicKey;
  instanceName: string;
  initialized: boolean = false;

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
    let str = (prefix == null ? ">" : prefix + ": ");
    console.log(str, this.toString());
    return this;
  }

  withName(instanceName: string): this {
    this.instanceName = instanceName;
    return this;
  }
}

type LocationType = { unexplored?: Record<string, never>; space?: Record<string, never>; planet?: Record<string, never>; moon?: Record<string, never>; asteroid?: Record<string, never>; };

class LocationState extends BaseState<LocationState> {

  x: number;
  xBN: anchor.BN;
  y: number;
  yBN: anchor.BN;
  occupiedSpace: number;
  type: LocationType;

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
    this.type = state.locationType;
    return this;
  }

  toString(): string {
    return `${this.instanceName}[${this.x}/${this.y}](type=${this.typeAsJson()})`;
  }

  typeAsJson(): string {
    return JSON.stringify(this.type);
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

  toString(): string {
    return `${this.instanceName}(${this.name})`;
  }
}

class StorageState extends BaseState<StorageState> {
  amount: number;
  arrivesAt: number;
  locationId: PublicKey;
  readonly resource: ResourceState;

  constructor(keyPair: KP, resource: ResourceState, instanceName: string = "Storage") {
    super(resource.program, keyPair, instanceName);
    this.resource = resource;
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

  name: string;
  atLocation: PublicKey;
  arrivesAt: number;

  public static async createPda(program: Program<GotAMin>, publicKey: PublicKey, instanceName: string): Promise<UnitState> {
    return new UnitState(program, null, instanceName, publicKey)
      .refresh();
  }

  async refresh(): Promise<UnitState> {
    let state = await this.program.account.unit.fetch(this.getPubKey());
    this.name = state.name;
    this.atLocation = state.atLocationId;
    this.arrivesAt = state.arrivesAt.toNumber();;
    return this;
  }

  toString(): string {
    return `${this.instanceName}(${this.name}, arrives: ${this.arrivesAt})`;
  }
}

function anchorBNtoNum(val: anchor.BN){
  return val.toNumber()
}

class MapState extends BaseState<MapState> {

  csm: CompressedSparseMatrix;

  async refresh(): Promise<MapState> {
    let state = await this.program.account.map.fetch(this.getPubKey());
    this.initialized = true;
    this.csm = new CompressedSparseMatrix(state.rowPtrs, state.columns, state.values, state.width, state.height, state.compressedValue);
    return this;
  }

  async put(x: number, y: number, value: number) {
    await this.program.methods
    .mapPut(x, y, value)
    .accounts({map: this.getPubKey()})
    .rpc();
  }

  get(x: number, y: number): number {
    return this.csm.get(x, y);
  }

  toString(): string {
    return `${this.instanceName}(${this.csm.width}x${this.csm.height} matrix=\n${this.csm.asMatrixToString()})`;
  }

  initMatrix(columns: number, rows: number): Array<Array<number>> {
    let matrix = new Array<Array<number>>(rows);

    for(let x = 0; x < columns; x++) {
        matrix[x] = new Array(rows);
        for(let y = 0; y < rows; y++) {
            matrix[x][y] = 0;
        }
    }
  
    return matrix;
}

  toMatrix(rowPtrs: Array<number>, columns: Array<number>, values: Array<number>): string {
    let csm = new CompressedSparseMatrix(rowPtrs, columns, values, 6, 5, 0);
    let matrix = this.initMatrix(20, 12);
    let costM = (matrix[0].length * 8) * (matrix.length * 8);
    let costCSM = (rowPtrs.length * 8) + (columns.length * 8) + values.length;
    //console.log("Matrix cost: " + costM + ", CSM cost: " + costCSM);

    let lines = "\n";
    lines += "row2: ";
    rowPtrs.forEach(function(a) { lines += a; });
    lines += "\n";
    lines += "col2: ";
    columns.forEach(function(a) { lines += a; });
    lines += "\n";
    lines += "val2: ";
    values.forEach(function(a) { lines += a; });
    lines += "\n";

    csm.unpack(matrix, 0, 0);

    let str = "";

    str += lines;

    str += "-- 1 --\n";
    for(let y = 0; y < matrix[0].length; y++) {
        for(let x = 0; x < matrix.length; x++) {
            str += matrix[x][y];
        }
        str += "\n";
    }
    str += "-- 2 --";

    return str;
  }
}

class CompressedSparseMatrix {
  width: number;
  height: number;
  compressedValue: number;
  rowPtrs: Array<number>;
  columns: Array<number>;
  values: Array<number>;
  
  constructor(rowPtrs: Array<number>, columns: Array<number>, values: Array<number>, width: number, height: number, compressedValue: number) {
    let rowPtrsLen = rowPtrs.map(num => num > 0).lastIndexOf(true);
    let columnsLen = columns.map(num => num > 0).lastIndexOf(true);
    let valuesLen = values.map(num => num > 0).lastIndexOf(true);
    let biggestLen = Math.max(columnsLen, valuesLen);
    console.log("biggestLen", biggestLen);

    this.rowPtrs = rowPtrs.slice(0, rowPtrsLen + 1);
    this.columns = columns.slice(0, biggestLen + 1);
    this.values = values.slice(0, biggestLen + 1);
    this.width = width;
    this.height = height;
    this.compressedValue = compressedValue;
  }

  static fromMatrix(matrix: Array<Array<number>>, compressValue: number = 0): CompressedSparseMatrix {
      let ptrs = new Array<number>();
      let cols = new Array<number>();
      let vals = new Array<number>();
  
      let prevPtr = -1;
      for(let y = 0; y < matrix[0].length; y++) {
          let perRowCounter = 0;
          for(let x = 0; x < matrix.length; x++) {
              let mvalue = matrix[x][y];
              if(mvalue != compressValue) {
                  if(y != prevPtr) {
                      ptrs.push(cols.length);
                      prevPtr = y;
                      perRowCounter++;
                  }
                  cols.push(x);
                  vals.push(mvalue);
              }
          }

          if(perRowCounter == 0) {
              ptrs.push(cols.length);
              cols.push(0);
              vals.push(compressValue);
      }
      }

      return new CompressedSparseMatrix(ptrs, cols, vals, matrix[0].length, matrix.length, compressValue);
  }

  static initMatrix(columns: number, rows: number, compressedValue: number): Array<Array<number>> {
      let matrix = new Array<Array<number>>(rows);
  
      for(let x = 0; x < columns; x++) {
          matrix[x] = new Array(rows);
          for(let y = 0; y < rows; y++) {
              matrix[x][y] = compressedValue;
          }
      }
    
      return matrix;
  }
  
  unpack(targetMatrix: Array<Array<number>>, startX: number = 0, startY: number = 0) {
      let rp = this.rowPtrs[0];
      let rpNext = this.rowPtrs[1]
      let rpIdx = 0;
      for(let c = 0; c < this.columns.length; c++) {
          let x = this.columns[c];
          let v = this.values[c];
  
          if(rpIdx < this.rowPtrs.length) {
              rp = this.rowPtrs[rpIdx];
          }
          
          if(rpIdx+1 < this.rowPtrs.length) {
              rpNext = this.rowPtrs[rpIdx+1];
          } else {
              rpNext = rp;
          }
  
          if(c > 0 && c == rpNext) {
              rpIdx++;
          }
  
          let targetX = startX + x;
          let targetY = startY + rpIdx;

          targetMatrix[targetX][targetY] = v;
      }
  }

  exists(x: number, y: number): boolean {
      let [i, _] = this.valuePtr(x, y);
      if(i >= 0) {
          return this.get(x, y) != this.compressedValue;
      } else {
          return false;
      }
  }

  get(x: number, y: number): number {
      let r = this.compressedValue;
      let [i, _] = this.valuePtr(x, y);
      if(i >= 0) {
          r = this.values[i];
      }
      return r;
  }

  put(x: number, y: number, newValue: number) {
      let r = 0;
      let [i, insertPoint] = this.valuePtr(x, y);
      if(i >= 0) {
          this.values[i] = newValue;
      } else {
          if(insertPoint >= 0) {
              this.columns.splice(insertPoint, 0, x);
              this.values.splice(insertPoint, 0, newValue);

              if(y < this.rowPtrs.length) {
                  let rpValNext = this.columns.length;
                  if(y+1 < this.rowPtrs.length) {
                      rpValNext = this.rowPtrs[y+1];
                  }
                  for(let i = y+1; i < this.rowPtrs.length; i++) {
                      let newRpVal = this.rowPtrs[i] + 1;
                      this.rowPtrs.splice(i, 1, newRpVal);
                  }
              }

              if(x >= this.width) {
                  this.width = x + 1;
              }
          } else {
              let xDiff = (x + 1) - this.width;
              if(xDiff > 0) {
                  this.width += xDiff;
              }

              let yDiff = (y + 1) - this.height;

              for(let addY = this.height; addY < y+1; addY++) {
                  this.rowPtrs.push(this.columns.length);
                  this.columns.push(0);
                  this.values.push(0);    
              }

              if(yDiff > 0) {
                  this.rowPtrs.push(this.columns.length);
                  this.columns.push(x);
                  this.values.push(newValue);    
                  this.height += yDiff;
              }
          }
      }
      return r;
  }

  valuePtr(x: number, y: number): [number, number] {
      let valueIndex = -1;
      let insertPoint = -1;
      if(y < this.rowPtrs.length) {
          let rpVal = this.rowPtrs[y];
          let rpValNext = this.columns.length;
          if(y+1 < this.rowPtrs.length) {
              rpValNext = this.rowPtrs[y+1];
          }
          let checkColSubset = false;
          let xInColumn = 0;
          //let colSubset = "";
          for(let colSubsetPos = rpVal; colSubsetPos < rpValNext; colSubsetPos++) {
              //colSubset += this.columns[colSubsetPos];
              if(x == this.columns[colSubsetPos]) {
                  xInColumn = colSubsetPos;
                  checkColSubset = true;
                  break;
              } else if(x < this.columns[colSubsetPos]) {
                  insertPoint = colSubsetPos;
                  break;
              } else if(colSubsetPos == rpValNext - 1) {
                  //console.log("colSubsetPos end: ", colSubsetPos);
                  insertPoint = colSubsetPos + 1;
              }
          }

          let checkMinimum = xInColumn >= 0 && checkColSubset;
          let checkMaxPerRowOrEnd = (xInColumn <= rpValNext);
          if(checkMinimum && checkMaxPerRowOrEnd) {
              let c = xInColumn;
              if(c < this.values.length) {
                  valueIndex = c;
              }
          }
          //console.log("valueIndex", valueIndex, "rpVal", rpVal, "x2", x2, "colSubset", colSubset);
      }
      return [valueIndex, insertPoint];
  }
  
  asMatrixToString(): string {
      let matrix = CompressedSparseMatrix.initMatrix(this.width, this.height, this.compressedValue);
      this.unpack(matrix);
      let str = "";
      for(let y = 0; y < matrix[0].length; y++) {
          for(let x = 0; x < matrix.length; x++) {
              str += matrix[x][y];
          }
          str += "\n";
      }
      return str;
  }

  debugCompressedAsString(): string {
      let lines = this.width + " x " + this.height + "\n";
      lines += "rowPtr: ";
      this.rowPtrs.forEach(function(a) { lines += a; });
      lines += "\n";
      lines += "col: ";
      this.columns.forEach(function(a) { lines += a; });
      lines += "\n";
      lines += "val: ";
      this.values.forEach(function(a) { lines += a; });
      return lines;        
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

async function createLocation2(program: Program<GotAMin>, name: string, position: [number, number], capacity: number, locationType = null):  Promise<LocationState> {
  let publicKey = await initLocation2(program, name, position, capacity, locationType);
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

async function moveUnitStart(unit: UnitState, toLocation: LocationState, current_timestamp: number) {
  let program = unit.program;
  const provider = program.provider as anchor.AnchorProvider;
  let pk = provider.wallet.publicKey;

  let unitPda = getUnitPda(program, pk, unit.name);
  let currentLocation = await fetchLocationStatePK(program, unit.atLocation);
  
  await program.methods
    .debugMoveUnitStart(
      currentLocation.xBN, 
      currentLocation.yBN, 
      toLocation.xBN, 
      toLocation.yBN, 
      unit.name, 
      new anchor.BN(current_timestamp),
    )
    .accounts({
      unit: unitPda,
      fromLocation: unit.atLocation,
      toLocation: toLocation.getPubKey(),
      owner: pk,
    })
    .rpc();

}

async function moveUnitComplete(unit: UnitState, toLocation: LocationState, map: MapState, current_timestamp: number) {
  let program = unit.program;
  const provider = program.provider as anchor.AnchorProvider;
  let pk = provider.wallet.publicKey;

  let unitPda = getUnitPda(program, pk, unit.name);
  
  await program.methods
    .debugMoveUnitComplete(
      toLocation.xBN, 
      toLocation.yBN, 
      unit.name, 
      new anchor.BN(current_timestamp),
    )
    .accounts({
      unit: unitPda,
      toLocation: toLocation.getPubKey(),
      map: map.getPubKey(),
      owner: pk,
    })
    .rpc();

}

async function initUnit(name: string, location: LocationState): Promise<UnitState> {
  let program = location.program;
  const provider = program.provider as anchor.AnchorProvider;
  let pk = provider.wallet.publicKey;

  let unitPda = getUnitPda(program, pk, name);
  
  const pdaInfo = await provider.connection.getAccountInfo(unitPda);
  if(pdaInfo == null) {
    await program.methods
      .initUnit(name, location.xBN, location.yBN)
      .accounts({
        unit: unitPda,
        location: location.getPubKey(),
        owner: pk,
      })
      .rpc();
  }

  return UnitState.createPda(program, unitPda, name);
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

async function debug_produce_with_2_inputs(producer: ProcessorState, storageOut: StorageState, resourceToProduce: ResourceState, storageInput1: StorageState, storageInput2: StorageState, current_timestamp: number) {
  let program = storageOut.program;
  const programProvider = program.provider as anchor.AnchorProvider;
  

  await program.methods
    .debugProduceWithTwoInputs(new anchor.BN(current_timestamp))
    .accounts({
      processor: producer.publicKey,
      storage: storageOut.getPubKey(),
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

async function moveStorage(storage: StorageState, fromLocation, toLocation) {
  let program = storage.program;
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

async function debugMoveStorage(storage: StorageState, fromLocation: LocationState, toLocation: LocationState, current_timestamp: number) {
  let program = storage.program;
  const programProvider = program.provider as anchor.AnchorProvider;

  await program.methods
    .debugMoveStorage(new anchor.BN(current_timestamp))
    .accounts({
      storage: storage.getPubKey(),
      fromLocation: fromLocation.getPubKey(),
      toLocation: toLocation.getPubKey(),
    })
    .rpc();
}

async function updateStorageMoveStatus(storage: StorageState) {
  let program = storage.program;
  const programProvider = program.provider as anchor.AnchorProvider;

  await program.methods
    .updateStorageMoveStatus()
    .accounts({
      storage: storage.getPubKey(),
    })
    .rpc();
}

async function debugUpdateStorageMoveStatus(storage: StorageState, current_timestamp: number) {
  let program = storage.program;
  const programProvider = program.provider as anchor.AnchorProvider;

  await program.methods
    .debugUpdateStorageMoveStatus(new anchor.BN(current_timestamp))
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

async function initMap(program: Program<GotAMin>): Promise<MapState> {
  const provider = program.provider as anchor.AnchorProvider;
  let pk = provider.wallet.publicKey;
  const key: anchor.web3.Keypair = anchor.web3.Keypair.generate();

  await program.methods
    .initMap(0)
    .accounts({
      map: key.publicKey,
      owner: pk,
    })
    .signers([key])
    .rpc();

  return new MapState(program, key, "Map");
}

