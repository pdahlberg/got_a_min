import * as anchor from "@project-serum/anchor";
//import { PublicKey, Keypair } from "@solana/web3.js";
import { assert, expect } from 'chai';
import { assertion, promise } from 'chai-as-promised';
import { AnchorError, Program } from "@project-serum/anchor";
import { GotAMin } from "../target/types/got_a_min";
import { publicKey } from "@project-serum/anchor/dist/cjs/utils";
import { SystemAccountsCoder } from "@project-serum/anchor/dist/cjs/coder/system/accounts";

type KP = anchor.web3.Keypair;

const DEFAULT_LOCATION = anchor.web3.Keypair.generate();

describe("/Unknown", async () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.GotAMin as Program<GotAMin>;
  const programProvider = program.provider as anchor.AnchorProvider;
  await initDefaultLocation(program);
  
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

  it("Init producer", async () => {
    const producer = anchor.web3.Keypair.generate();
    const resource = anchor.web3.Keypair.generate();
    await initResource(program, resource, "A", []);

    let result = await initProducer(program, producer, resource, 1);
    
    expect(result.owner.toBase58()).to.equal(programProvider.wallet.publicKey.toBase58());
    expect(result.productionRate.toNumber()).to.equal(1);
    expect(result.resourceId.toBase58()).to.equal(resource.publicKey.toBase58());
  });

  it("Produce 1 of resource A with delay", async () => {
    let producerProdRate = 1;
    let [resource, _1] = await createResource(program, 'A', []);
    let [producer, _2] = await createProducer(program, resource, producerProdRate);
    let [storage, _3] = await createStorage(program, resource, 1);

    // Production in progress
    let storageResult = await produce_without_input(program, producer, storage, resource);
    let producerResult = await program.account.producer.fetch(producer.publicKey);

    expect(producerResult.awaitingUnits.toNumber(), "1) producer awaitingUnits").to.equal(producerProdRate);
    expect(storageResult.resourceId.toBase58()).to.equal(resource.publicKey.toBase58());
    expect(storageResult.amount.toNumber(), "storage amount").to.equal(0);

    // Production is done after delay
    await new Promise(f => setTimeout(f, 5001)); // todo: delay 5+ seconds... 
    let storageResult2 = await produce_without_input(program, producer, storage, resource);
    let producerResult2 = await program.account.producer.fetch(producer.publicKey);

    expect(producerResult2.awaitingUnits.toNumber(), "2) producer awaitingUnits").to.equal(producerProdRate);
    expect(storageResult2.amount.toNumber(), "storage amount").to.equal(producerProdRate);
  });

  it("Produce 1 of resource A without delay", async () => {
    let producerProdRate = 1;
    let [resource, _1] = await createResource(program, 'A', []);
    let [producer, _2] = await createProducer(program, resource, producerProdRate, 0);
    let [storage, _3] = await createStorage(program, resource, 1);

    // Production in progress
    let storageResult = await produce_without_input(program, producer, storage, resource);
    let producerResult = await program.account.producer.fetch(producer.publicKey);

    expect(producerResult.awaitingUnits.toNumber(), "producerResult.awaitingUnits").to.equal(0);
    expect(storageResult.amount.toNumber(), "storage amount").to.equal(1);
  });

  it("Produce 2 of resource A without delay and Storage below full capacity", async () => {
    let producerProdRate = 5;
    let [resource, _1] = await createResource(program, 'A', []);
    let [producer, _2] = await createProducer(program, resource, producerProdRate, 0);
    let [storage, _3] = await createStorage(program, resource, 3);

    // Production in progress
    let storageResult = await produce_without_input(program, producer, storage, resource);
    let producerResult = await program.account.producer.fetch(producer.publicKey);

    expect(producerResult.awaitingUnits.toNumber(), "producerResult.awaitingUnits").to.equal(2);
    expect(storageResult.amount.toNumber(), "storage amount").to.equal(3);
  });

  it("Produce 2 of resource B", async () => {
    let producerProdRate = 2;
    let [resource, _1] = await createResource(program, 'B', []) as [KP, any];
    let [producer, _2] = await createProducer(program, resource, producerProdRate);
    let [storage, _3] = await createStorage(program, resource, 2);

    let storageResult = await produce_without_input(program, producer, storage, resource);
    let producerResult = await program.account.producer.fetch(producer.publicKey);

    expect(storageResult.amount.toNumber(), "storage amount").to.equal(0);

    // Production is done after delay
    await new Promise(f => setTimeout(f, 5001)); // todo: delay 5+ seconds... 
    let storageResult2 = await produce_without_input(program, producer, storage, resource);
    let producerResult2 = await program.account.producer.fetch(producer.publicKey);

    expect(producerResult2.awaitingUnits.toNumber(), "producer awaitingUnits").to.equal(producerProdRate);
    expect(storageResult2.amount.toNumber(), "storage amount").to.equal(producerProdRate);
  });

  it("Produce 1 resource B from 2 A", async () => {
    let producerBProdRate = 1;
    let [resourceA, _1] = await createResource(program, 'A', []);
    let [producerA, _2] = await createProducer(program, resourceA, 5, 0);
    let [storageA, _3] = await createStorage(program, resourceA, 5);
    let [resourceB, _4] = await createResource(program, 'B', [[resourceA, 2]]);
    let [producerB, _5] = await createProducer(program, resourceB, producerBProdRate, 5);
    let [storageB, _6] = await createStorage(program, resourceB, 5);
    
    let storageAResult = await produce_without_input(program, producerA, storageA, resourceA);
    expect(storageAResult.amount.toNumber()).to.equal(5);
    //await produce_without_input(program, producerA, storageA, resourceA);

    let storageBResult = await produce_with_1_input(program, producerB, storageB, resourceB, storageA);
    let producerBResult = await program.account.producer.fetch(producerB.publicKey);
    let inputAResult = await program.account.storage.fetch(storageA.publicKey);

    expect(producerBResult.awaitingUnits.toNumber(), "producerBResult.awaitingUnits").to.equal(producerBProdRate);
    expect(storageBResult.amount.toNumber(), "storageBResult.amount").to.equal(0);
    expect(inputAResult.amount.toNumber(), "inputAResult.amount").to.equal(3);    

    // Production is done after delay
    await new Promise(f => setTimeout(f, 5001)); // todo: delay 5+ seconds... 
    let storageBResult2 = await produce_with_1_input(program, producerB, storageB, resourceB, storageA);
    let producerBResult2 = await program.account.producer.fetch(producerB.publicKey);

    expect(producerBResult2.awaitingUnits.toNumber(), "producerBResult2.awaitingUnits").to.equal(producerBProdRate);
    expect(storageBResult2.amount.toNumber(), "storageBResult2.amount").to.equal(1);    
  });


  it("Produce resource B with input A fails when A is empty", async () => {
    let [resourceA, _1] = await createResource(program, 'A', []);
    let [storageA, _2] = await createStorage(program, resourceA, 1);
    let [resourceB, _3] = await createResource(program, 'B', [[resourceA, 1]]);
    let [producerB, _4] = await createProducer(program, resourceB, 2);
    let [storageB, _5] = await createStorage(program, resourceB, 1);

    // await expect(stuff(program, producerB, resourceB, resourceA)).should.be.rejectedWith("I AM THE EXPECTED ERROR");
    try {
      await produce_with_1_input(program, producerB, storageB, resourceB, storageA);
      
      assert(false, "Expected to fail");
    } catch(e) {
      assertAnchorError(e, "InputStorageAmountTooLow");
    }

  });

});

describe("/Production", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.GotAMin as Program<GotAMin>;
  const programProvider = program.provider as anchor.AnchorProvider;

  it("Produce 1 resource C from 1 A + 1 B", async () => {
    let producerCProdRate = 2;
    let [resourceA, _1] = await createResource(program, 'A', []);
    let [producerA, _2] = await createProducer(program, resourceA, 1, 0);
    let [storageA, _3] = await createStorage(program, resourceA, 1);
    let [resourceB, _4] = await createResource(program, 'B', []);
    let [producerB, _5] = await createProducer(program, resourceB, 1, 0);
    let [storageB, _6] = await createStorage(program, resourceB, 1);
    let [resourceC, _7] = await createResource(program, 'C', [[resourceA, 1], [resourceB, 1]]);
    let [producerC, _8] = await createProducer(program, resourceC, producerCProdRate, 0);
    let [storageC, _9] = await createStorage(program, resourceC, 2);
    await produce_without_input(program, producerA, storageA, resourceA);
    await produce_without_input(program, producerB, storageB, resourceB);

    let storageCResult = await produce_with_2_inputs(program, producerC, storageC, resourceC, storageA, storageB);
    let producerCResult = await program.account.producer.fetch(producerC.publicKey);
    let inputAResult = await program.account.storage.fetch(storageA.publicKey);
    let inputBResult = await program.account.storage.fetch(storageB.publicKey);

    expect(producerCResult.awaitingUnits.toNumber(), "producerCResult.awaitingUnits").to.equal(0);
    expect(storageCResult.amount.toNumber(), "storageCResult.amount").to.equal(2);
    expect(inputAResult.amount.toNumber(), "inputAResult.amount").to.equal(0);    
    expect(inputBResult.amount.toNumber(), "inputBResult.amount").to.equal(0);    
  });

});

describe("/Transportation", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.GotAMin as Program<GotAMin>;
  const programProvider = program.provider as anchor.AnchorProvider;

  it("Move movable Storage", async () => {
    let [resource, _1] = await createResource(program, 'A', []);
    let location1 = await createLocation(program, 'loc1', 0, 10);
    let [storage, _3] = await createStorage(program, resource, 10, location1, {movable:{}});
    let location2 = await createLocation(program, 'loc2', 1, 10);

    await move_storage(program, storage, location1, location2);
    let result = await program.account.storage.fetch(storage.publicKey);

    expect(result.locationId.toBase58()).to.equal(location2.publicKey.toBase58());
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
    let [producer, _2] = await createProducer(program, resource, 10, 0);
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
    let [producer, _2] = await createProducer(program, resource, 10, 0);
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
    let [producerA, _2] = await createProducer(program, resourceA, 10, 0);
    let [storageAFrom, _3] = await createStorage(program, resourceA, 10);
    let [resourceB, _4] = await createResource(program, 'B', []);
    let [producerB, _5] = await createProducer(program, resourceB, 10, 0);
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

  it("Init location", async () => {
    const location = anchor.web3.Keypair.generate();

    let result = await initLocation(program, location, 'name', 0, 5);
    
    expect(result.owner.toBase58()).to.equal(programProvider.wallet.publicKey.toBase58());
    expect(result.position.toNumber()).to.equal(0);
    expect(result.capacity.toNumber()).to.equal(5);
    expect(result.name).to.equal('name');
  });

  it("Move between Storage in different locations", async () => {
    let [resource, _1] = await createResource(program, 'A', []);
    let locationA = await createLocation(program, 'locA', 0, 10);
    let [producerA, _2] = await createProducer(program, resource, 10, 0, locationA);
    let [storageAFrom, _3] = await createStorage(program, resource, 10, locationA);
    let locationB = await createLocation(program, 'locB', 1, 10);
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
    let location = await createLocation(program, 'locA', 0, 10);
    let [producer, _2] = await createProducer(program, resource, 10, 0);
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
    let location1 = await createLocation(program, 'loc1', 0, 10);
    let [storage, _3] = await createStorage(program, resource, 10, location1);
    let location2 = await createLocation(program, 'loc2', 1, 10);

    try {
      await move_storage(program, storage, location1, location2);

      assert(false, "Expected to fail");
    } catch(e) {
      assertAnchorError(e, "StorageTypeNotMovable");
    }
  });  

  it("Move Storage to full Location fails", async () => {
    let [resource, _1] = await createResource(program, 'A', []);
    let location1 = await createLocation(program, 'loc1', 0, 10);
    let [storage, _3] = await createStorage(program, resource, 10, location1, {movable:{}});
    let location2 = await createLocation(program, 'loc2', 1, 0);

    try {
      await move_storage(program, storage, location1, location2);

      assert(false, "Expected to fail");
    } catch(e) {
      assertAnchorError(e, "LocationFull");
    }
  });

  it("Move Storage to new Location", async () => {
    let [resource, _1] = await createResource(program, 'A', []);
    let location1 = await createLocation(program, 'loc1', 0, 10);
    let [storage, _3] = await createStorage(program, resource, 10, location1, {movable:{}});
    let location2 = await createLocation(program, 'loc2', 1, 10);

    await move_storage(program, storage, location1, location2);
    let storageResult = await program.account.storage.fetch(storage.publicKey);
    let location1Result = await program.account.location.fetch(location1.publicKey);
    let location2Result = await program.account.location.fetch(location2.publicKey);

    expect(storageResult.locationId.toBase58()).equal(location2.publicKey.toBase58());
    expect(location1Result.occupiedSpace.toNumber()).equal(0);
    expect(location2Result.occupiedSpace.toNumber()).equal(1);
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

async function createProducer(program: Program<GotAMin>, resource, productionRate, productionTime = 5, location = DEFAULT_LOCATION): Promise<[KP, any]> {
  const producer = anchor.web3.Keypair.generate();
  return [producer, await initProducer(program, producer, resource, productionRate, productionTime, location)];
}

async function initProducer(program: Program<GotAMin>, producer, resource, productionRate, productionTime = 5, location = DEFAULT_LOCATION) {
  const programProvider = program.provider as anchor.AnchorProvider;
  const prodRateBN = new anchor.BN(productionRate);
  const prodTimeBN = new anchor.BN(productionTime);

  await program.methods
    .initProducer(resource.publicKey, location.publicKey, prodRateBN, prodTimeBN)
    .accounts({
      producer: producer.publicKey,
      owner: programProvider.wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers(producer)
    .rpc();
    
    return await program.account.producer.fetch(producer.publicKey);
}

async function createStorage(program: Program<GotAMin>, resource: KP, capacity: number, location: KP = DEFAULT_LOCATION, mobilityType: MobilityType = {fixed:{}}): Promise<[KP, any]> {
  const storage: KP = anchor.web3.Keypair.generate();
  return [storage, await initStorage(program, storage, resource, capacity, location, mobilityType)];
}

type MobilityType = {fixed:{}} | {movable:{}};

async function initStorage(program: Program<GotAMin>, storage, resource: KP, capacity: number, location: KP = DEFAULT_LOCATION, mobilityType: MobilityType = {fixed:{}}) {
  const programProvider = program.provider as anchor.AnchorProvider;

  await program.methods
    .initStorage(resource.publicKey, new anchor.BN(capacity), mobilityType)
    .accounts({
      storage: storage.publicKey,
      location: location.publicKey,
      owner: programProvider.wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers(storage)
    .rpc();
    
  return await program.account.storage.fetch(storage.publicKey);
}

async function createLocation(program: Program<GotAMin>, name: string, position: number, capacity: number):  Promise<KP> {
  const location: anchor.web3.Keypair = anchor.web3.Keypair.generate();
  await initLocation(program, location, name, position, capacity);
  return location;
}

async function initDefaultLocation(program: Program<GotAMin>) {
  return initLocation(program, DEFAULT_LOCATION, 'default', 999, 999);
}

async function initLocation(program: Program<GotAMin>, location, name: string, position: number, capacity: number) {
  const programProvider = program.provider as anchor.AnchorProvider;

  await program.methods
    .initLocation(name, new anchor.BN(position), new anchor.BN(capacity))
    .accounts({
      location: location.publicKey,
      owner: programProvider.wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers(location)
    .rpc();
    
  return await program.account.location.fetch(location.publicKey);
}

async function produce_without_input(program: Program<GotAMin>, producer, storage, resource) {
  const programProvider = program.provider as anchor.AnchorProvider;

  await program.methods
    .produceWithoutInput()
    .accounts({
      producer: producer.publicKey,
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
      producer: producer.publicKey,
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
      producer: producer.publicKey,
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

