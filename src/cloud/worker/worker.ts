import { Cloud, CloudTransaction } from "./cloud.js";

/**
 * Abstract class for the zkCloudWorker
 * Used to define the zkCloudWorker methods and properties
 * Should be implemented for by the developer for the zkCloudWorker in the cloud
 */
export abstract class zkCloudWorker {
  /**  cloud: the cloud instance */
  readonly cloud: Cloud;

  /**
   * Constructor for the zkCloudWorker class
   * @param cloud the cloud instance provided by the zkCloudWorker in the local environment or in the cloud
   */
  constructor(cloud: Cloud) {
    this.cloud = cloud;
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
