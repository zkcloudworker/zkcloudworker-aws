import { blockchain } from "../networks";
import { JobData } from "./job";

/**
 * Interface for the deployed smart contract
 * Used to get verification keys and addresses of the deployed smart contracts
 * to be published in the blockchain explorer
 * @param address: the address of the deployed smart contract
 * @param name: the name of the deployed smart contract
 * @param chain: the blockchain network where the smart contract is deployed
 * @param verificationKey: the verification key of the deployed smart contract
 * @param verificationKey.hash: the hash of the verification key
 * @param verificationKey.data: the data of the verification key
 */
export interface DeployedSmartContract {
  address: string;
  name: string;
  chain: blockchain;
  verificationKey: { hash: string; data: string };
}

/**
 * Interface for the deployer key pair
 * Used to get the public and private keys of the deployer for test networks only
 * Devnet and Zeko are supported
 * @param publicKey: the public key of the deployer
 * @param privateKey: the private key of the deployer
 */
export interface DeployerKeyPair {
  publicKey: string;
  privateKey: string;
}

/**
 * Interface for the cloud transaction
 * Used to get the transaction id, the transaction, and the time received
 * @param txId: the transaction id
 * @param transaction: the transaction
 * @param timeReceived: the time received
 */
export interface CloudTransaction {
  txId: string;
  transaction: string;
  timeReceived: number;
  status: string;
}

/*
 * Abstract class for the cloud service
 * Used to define the cloud methods and properties
 * Should be implemented by for local testing and for the zkCloudWorker in the cloud
 * @param id the id of the user
 * @param jobId the job id
 * @param stepId the step id
 * @param taskId the task id
 * @param cache the cache folder. Use it to get the Cache object: cache = Cache.FileSystem(this.cloud.cache);
 * @param developer the developer id
 * @param repo the repo id
 * @param task the task id
 * @param userId the user id
 * @param args the arguments, should be a string or serialized JSON
 * @param metadata the metadata, should be a string or serialized JSON
 * @param chain the blockchain network
 * @param isLocalCloud a boolean to check if the cloud is local or not
 */
export abstract class Cloud {
  readonly id: string;
  readonly jobId: string;
  readonly stepId: string;
  readonly taskId: string;
  readonly cache: string;
  readonly developer: string;
  readonly repo: string;
  readonly task?: string;
  readonly userId?: string;
  readonly args?: string;
  readonly metadata?: string;
  readonly chain: blockchain;
  readonly isLocalCloud: boolean;

  /**
   * Constructor for the Cloud class
   * @param params the parameters for the Cloud class
   * @param params.id the id of the user
   * @param params.jobId the job id
   * @param params.stepId the step id
   * @param params.taskId the task id
   * @param params.cache the cache folder. Use it to get the Cache object: cache = Cache.FileSystem(this.cloud.cache);
   * @param params.developer the developer id
   * @param params.repo the repo id
   * @param params.task the task id
   * @param params.userId the user id
   * @param params.args the arguments, should be a string or serialized JSON
   * @param params.metadata the metadata, should be a string or serialized JSON
   * @param params.chain the blockchain network
   * @param params.isLocalCloud a boolean to check if the cloud is local or not
   */
  constructor(params: {
    id: string;
    jobId: string;
    stepId: string;
    taskId: string;
    cache: string;
    developer: string;
    repo: string;
    task?: string;
    userId?: string;
    args?: string;
    metadata?: string;
    isLocalCloud?: boolean;
    chain: blockchain;
  }) {
    const {
      id,
      jobId,
      stepId,
      taskId,
      cache,
      developer,
      repo,
      task,
      userId,
      args,
      metadata,
      isLocalCloud,
      chain,
    } = params;
    this.id = id;
    this.jobId = jobId;
    this.stepId = stepId;
    this.taskId = taskId;
    this.cache = cache;
    this.developer = developer;
    this.repo = repo;
    this.task = task;
    this.userId = userId;
    this.args = args;
    this.metadata = metadata;
    this.isLocalCloud = isLocalCloud ?? false;
    this.chain = chain;
  }

  /**
   * Abstract method to get the deployer key pair
   * Used to get the public and private keys of the deployer for test networks only
   * Devnet and Zeko are supported
   * @returns the deployer key pair
   */
  abstract getDeployer(): Promise<DeployerKeyPair | undefined>;

  /**
   * Abstract method to release the deployer
   * @param params the public key of the deployer and the transactions hashes
   * Used to release the deployer after the transactions are sent to the blockchain
   * @param params.publicKey the public key of the deployer
   * @param params.txsHashes the transactions hashes
   */
  abstract releaseDeployer(params: {
    publicKey: string;
    txsHashes: string[];
  }): Promise<void>;

  /**
   * Abstract method to get the data by key
   * Used to get the data by key from the cloud storage
   * @param key the key
   * @returns the value of the key
   */
  abstract getDataByKey(key: string): Promise<string | undefined>;

  /**
   * Abstract method to save the data by key
   * Used to save the data by key to the cloud storage
   * @param key the key
   * @param value the value
   */
  abstract saveDataByKey(key: string, value: string | undefined): Promise<void>;

  /**
   * Abstract method to save the file
   * Used to save the file to the cloud storage
   * @param filename the filename
   * @param value the value
   */
  abstract saveFile(filename: string, value: Buffer): Promise<void>;

  /**
   * Abstract method to load the file
   * Used to load the file from the cloud storage
   * @param filename the filename
   * @returns the value of the file
   */
  abstract loadFile(filename: string): Promise<Buffer | undefined>;

  /**
   * Abstract method to load the environment
   * Used to load the environment from the cloud storage
   * @param password the password
   */
  abstract loadEnvironment(password: string): Promise<void>;

  /**
   * Abstract method to calculate the recursive proof
   * Used to calculate the recursive proof
   * @param data the data
   * @param data.transactions the transactions
   * @param data.task the task
   * @param data.userId the user id
   * @param data.args the arguments
   * @param data.metadata the metadata
   * @returns the proof
   */
  abstract recursiveProof(data: {
    transactions: string[];
    task?: string;
    userId?: string;
    args?: string;
    metadata?: string;
  }): Promise<string>;

  /**
   * Abstract method to execute the transactions
   * Used to execute the transactions
   * @param data the data
   * @param data.transactions the transactions
   * @param data.task the task
   * @param data.userId the user id
   * @param data.args the arguments
   * @param data.metadata the metadata
   * @returns the result
   */
  abstract execute(data: {
    transactions: string[];
    task: string;
    userId?: string;
    args?: string;
    metadata?: string;
  }): Promise<string>;

  /**
   * Abstract method to add the task
   * Used to add the task
   * @param data the data
   * @param data.task the task
   * @param data.startTime the start time
   * @param data.userId the user id
   * @param data.args the arguments
   * @param data.metadata the metadata
   * @param data.maxAttempts the maximum attempts
   * @returns the task id
   */
  abstract addTask(data: {
    task: string;
    startTime?: number;
    userId?: string;
    args?: string;
    metadata?: string;
    maxAttempts?: number;
  }): Promise<string>;

  /**
   * Abstract method to send the transactions
   * @param transactions
   */
  abstract sendTransactions(
    transactions: string[] | CloudTransaction[]
  ): Promise<CloudTransaction[]>;

  /**
   * Abstract method to delete the transaction
   * Used to delete the transaction
   * @param txId the transaction id
   */
  abstract deleteTransaction(txId: string): Promise<void>;

  /**
   * Abstract method to get the transactions
   * Used to get the transactions
   * @returns the transactions
   */
  abstract getTransactions(): Promise<CloudTransaction[]>;

  /**
   * Abstract method to delete the task
   * Used to delete the task
   * @param taskId the task id
   */
  abstract deleteTask(taskId: string): Promise<void>;

  /**
   * Abstract method to process the tasks
   */
  abstract processTasks(): Promise<void>;

  /**
   * Abstract method to get the job result
   * Used to get the job result
   * @param jobId the job id
   * @returns the job result
   */
  abstract jobResult(jobId: string): Promise<JobData | undefined>;

  /**
   * forces the worker to restart the AWS lambda container
   * See https://github.com/o1-labs/o1js/issues/1651
   */
  abstract forceWorkerRestart(): Promise<void>;
}

/**
 * Abstract class for the zkCloudWorker
 * Used to define the zkCloudWorker methods and properties
 * Should be implemented for by the developer for the zkCloudWorker in the cloud
 * @param cloud: the cloud
 */
export abstract class zkCloudWorker {
  readonly cloud: Cloud;

  /**
   * Constructor for the zkCloudWorker class
   * @param cloud the cloud instance provided by the zkCloudWorker in the local environment or in the cloud
   */
  constructor(cloud: Cloud) {
    this.cloud = cloud;
  }

  /**
   * Returns the deployed smart contracts for verification in the blockchain explorer
   * @returns the deployed smart contracts
   */
  async deployedContracts(): Promise<DeployedSmartContract[]> {
    return [];
  }

  // Those methods should be implemented for recursive proofs calculations
  /**
   * Creates a new proof from a transaction
   * @param transaction the transaction
   * @returns the serialized proof
   */
  async create(transaction: string): Promise<string | undefined> {
    return undefined;
  }

  /**
   * Merges two proofs
   * @param proof1 the first proof
   * @param proof2 the second proof
   * @returns the merged proof
   */
  async merge(proof1: string, proof2: string): Promise<string | undefined> {
    return undefined;
  }

  // Those methods should be implemented for anything except for recursive proofs
  /**
   * Executes the transactions
   * @param transactions the transactions, can be empty list
   * @returns the result
   */
  async execute(transactions: string[]): Promise<string | undefined> {
    return undefined;
  }

  /* Process the transactions received by the cloud
   * @param transactions: the transactions
   */
  async processTransactions(transactions: CloudTransaction[]): Promise<void> {}

  /**
   * process the task defined by the developer
   * @returns the result
   */
  async task(): Promise<string | undefined> {
    return undefined;
  }
}
