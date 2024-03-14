import { BackendPlugin, sleep, fee } from "zkcloudworker";
import {
  Cache,
  verify,
  JsonProof,
  VerificationKey,
  Field,
  PublicKey,
  Signature,
  fetchAccount,
  Mina,
} from "o1js";
import { getDeployer } from "../../mina/deployers";
import { minaInit } from "../../mina/init";
import {
  MapTransition,
  MapUpdate,
  MapUpdateData,
  MapUpdateProof,
} from "./rollup/transaction";
import { Storage } from "./contract/storage";

export class DomainNameServicePlugin extends BackendPlugin {
  static mapUpdateVerificationKey: VerificationKey | undefined = undefined;
  static mapContractVerificationKey: VerificationKey | undefined = undefined;

  constructor(params: { name: string; task: string; args: string[] }) {
    super(params);
  }
  public async compile(cache: Cache): Promise<void> {
    if (DomainNameServicePlugin.mapUpdateVerificationKey === undefined)
      DomainNameServicePlugin.mapUpdateVerificationKey = (
        await MapUpdate.compile({
          cache,
        })
      ).verificationKey;
    else console.log("mapUpdateVerificationKey already exists");
    /*
    if (
      (this.task === "send" || this.task === "mint") &&
      DomainNameServicePlugin.mapContractVerificationKey === undefined
    )
      DomainNameServicePlugin.mapContractVerificationKey = (
        await MapContract.compile({
          cache,
        })
      ).verificationKey;
      */
  }

  public async create(transaction: string): Promise<string | undefined> {
    if (DomainNameServicePlugin.mapUpdateVerificationKey === undefined)
      throw new Error("verificationKey is undefined");
    console.time("create mapPoof");
    const args = JSON.parse(transaction);
    const isAccepted = args.isAccepted;
    const state: MapTransition = MapTransition.fromFields(
      args.state.map((f: string) => Field.fromJSON(f))
    ) as MapTransition;
    const address = PublicKey.fromBase58(args.address);
    console.log("address", address.toBase58());
    console.log("isAccepted", isAccepted);

    let proof: MapUpdateProof;
    //if (isAccepted === true) {
    const update: MapUpdateData = MapUpdateData.fromFields(
      args.update.map((f: string) => Field.fromJSON(f))
    ) as MapUpdateData;

    proof = await MapUpdate.add(state, update);
    /*
    } 
    else {
      const name = Field.fromJSON(args.name);
      const root = Field.fromJSON(args.root);
      proof = await MapUpdate.reject(state, root, name, address);
    }
    */
    const ok = await verify(
      proof.toJSON(),
      DomainNameServicePlugin.mapUpdateVerificationKey
    );
    if (!ok) throw new Error("proof verification failed");
    console.timeEnd("create mapPoof");
    return JSON.stringify(proof.toJSON(), null, 2);
  }

  public async merge(
    proof1: string,
    proof2: string
  ): Promise<string | undefined> {
    try {
      if (DomainNameServicePlugin.mapUpdateVerificationKey === undefined)
        throw new Error("verificationKey is undefined");
      console.time("merge mapPoof");

      const sourceProof1: MapUpdateProof = MapUpdateProof.fromJSON(
        JSON.parse(proof1) as JsonProof
      );
      const sourceProof2: MapUpdateProof = MapUpdateProof.fromJSON(
        JSON.parse(proof2) as JsonProof
      );
      const state = MapTransition.merge(
        sourceProof1.publicInput,
        sourceProof2.publicInput
      );
      const proof = await MapUpdate.merge(state, sourceProof1, sourceProof2);
      const ok = await verify(
        proof.toJSON(),
        DomainNameServicePlugin.mapUpdateVerificationKey
      );
      if (!ok) throw new Error("proof verification failed");
      console.timeEnd("merge mapPoof");
      return JSON.stringify(proof.toJSON(), null, 2);
    } catch (error) {
      console.log("Error in merge", error);
      throw error;
    }
  }

  public async verify(proof: string): Promise<string | undefined> {
    if (DomainNameServicePlugin.mapUpdateVerificationKey === undefined)
      throw new Error("verificationKey is undefined");
    const ok = await verify(
      JSON.parse(proof) as JsonProof,
      DomainNameServicePlugin.mapUpdateVerificationKey
    );
    return ok ? "true" : "false";
  }

  public async send(transaction: string): Promise<string | undefined> {
    /*
    minaInit();
    const deployer = await getDeployer();
    const sender = deployer.toPublicKey();
    const contractAddress = PublicKey.fromBase58(this.args[1]);
    const zkApp = new MapContract(contractAddress);
    await fetchMinaAccount(deployer.toPublicKey());
    await fetchMinaAccount(contractAddress);
    let tx;

    const args = JSON.parse(transaction);
    if (this.args[0] === "add") {
      const name = Field.fromJSON(args.name);
      const address = PublicKey.fromBase58(args.address);
      const signature = Signature.fromBase58(args.signature);
      const storage: Storage = new Storage({
        hashString: [
          Field.fromJSON(args.storage[0]),
          Field.fromJSON(args.storage[1]),
        ],
      });

      tx = await Mina.transaction(
        { sender, fee: await fee(), memo: "add" },
        () => {
          zkApp.add(name, address, storage, signature);
        }
      );
    } else if (this.args[0] === "reduce") {
      try {
        const startActionState = Field.fromJSON(args.startActionState);
        const endActionState = Field.fromJSON(args.endActionState);
        const reducerState = new ReducerState({
          count: Field.fromJSON(args.reducerState.count),
          hash: Field.fromJSON(args.reducerState.hash),
        });
        const count = Number(reducerState.count.toBigInt());
        console.log("ReducerState count", reducerState.count.toJSON());
        await fetchMinaActions(contractAddress, startActionState);

        const proof: MapUpdateProof = MapUpdateProof.fromJSON(
          JSON.parse(args.proof) as JsonProof
        );
        console.log("proof count", proof.publicInput.count.toJSON());
        const signature = Signature.fromBase58(args.signature);

        tx = await Mina.transaction(
          { sender, fee: await fee(), memo: "reduce" },
          () => {
            zkApp.reduce(
              startActionState,
              endActionState,
              reducerState,
              proof,
              signature
            );
          }
        );
      } catch (error) {
        console.log("Error in reduce", error);
      }
    } else if (this.args[0] === "setRoot") {
      const root = Field.fromJSON(args.root);
      const count = Field.fromJSON(args.count);
      const signature = Signature.fromBase58(args.signature);

      tx = await Mina.transaction(
        { sender, fee: await fee(), memo: "reset" },
        () => {
          zkApp.setRoot(root, count, signature);
        }
      );
    } else throw new Error("unknown action");

    if (tx === undefined) throw new Error("tx is undefined");
    await tx.prove();
    const txSent = await tx.sign([deployer]).send();
    if (txSent === undefined) throw new Error("tx is undefined");
    const hash: string | undefined = txSent.hash;
    if (hash === undefined) throw new Error("hash is undefined");
    return hash;
    */
    throw new Error("not implemented");
  }

  public async mint(transaction: string): Promise<string | undefined> {
    throw new Error("not implemented");
  }
}

async function fetchMinaAccount(publicKey: PublicKey) {
  const timeout = 1000 * 60 * 5; // 5 minutes
  const startTime = Date.now();
  let result = { account: undefined };
  while (Date.now() - startTime < timeout) {
    try {
      const result = await fetchAccount({
        publicKey,
      });
      if (result.account !== undefined) return result;
      console.log("Cannot fetch account", publicKey.toBase58(), result);
    } catch (error) {
      console.log("Error in fetchAccount:", error);
    }
    await sleep(1000 * 10);
  }
  console.log("Timeout in fetchAccount");
  return result;
}

async function fetchMinaActions(
  publicKey: PublicKey,
  fromActionState?: Field,
  endActionState?: Field
): Promise<void> {
  const timeout = 1000 * 60 * 5; // 5 minutes
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      let actions = await Mina.fetchActions(publicKey, {
        fromActionState,
        endActionState,
      });
      if (Array.isArray(actions)) return;
      else console.log("Cannot fetch actions - wrong format");
    } catch (error) {
      console.log("Error in fetchMinaActions", error);
    }
    await sleep(1000 * 10);
  }
  console.log("Timeout in fetchMinaActions");
  return;
}
