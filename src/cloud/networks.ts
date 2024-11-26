export {
  blockchain,
  MinaNetwork,
  networks,
  Mainnet,
  Devnet,
  Zeko,
  Lightnet,
  Local,
};

/**
 * blockchain is the type for the chain ID.
 */
type blockchain = "local" | "devnet" | "lightnet" | "mainnet" | "zeko";

/**
 * MinaNetwork is the data structure for a Mina network, keeping track of the Mina and archive endpoints, chain ID, name, account manager, explorer account URL, explorer transaction URL, and faucet.
 */
interface MinaNetwork {
  /** The Mina endpoints */
  mina: string[];

  /** The archive endpoints */
  archive: string[];

  /** The chain ID */
  chainId: blockchain;

  /** The name of the network (optional) */
  name?: string;

  /** The account manager for Lightnet (optional) */
  accountManager?: string;

  /** The explorer account URL (optional) */
  explorerAccountUrl?: string;

  /** The explorer transaction URL (optional) */
  explorerTransactionUrl?: string;

  /** The faucet URL (optional) */
  faucet?: string;
}

const Mainnet: MinaNetwork = {
  mina: [
    //"https://proxy.devnet.minaexplorer.com/graphql",
    "https://api.minascan.io/node/mainnet/v1/graphql",
  ],
  archive: [
    "https://api.minascan.io/archive/mainnet/v1/graphql",
    //"https://archive.devnet.minaexplorer.com",
  ],
  explorerAccountUrl: "https://minascan.io/mainnet/account/",
  explorerTransactionUrl: "https://minascan.io/mainnet/tx/",
  chainId: "mainnet",
  name: "Mainnet",
};

const Local: MinaNetwork = {
  mina: [],
  archive: [],
  chainId: "local",
};

const Devnet: MinaNetwork = {
  mina: [
    "https://api.minascan.io/node/devnet/v1/graphql",
    //"https://proxy.devnet.minaexplorer.com/graphql",
  ],
  archive: [
    "https://api.minascan.io/archive/devnet/v1/graphql",
    //"https://archive.devnet.minaexplorer.com",
  ],
  explorerAccountUrl: "https://minascan.io/devnet/account/",
  explorerTransactionUrl: "https://minascan.io/devnet/tx/",
  chainId: "devnet",
  name: "Devnet",
  faucet: "https://faucet.minaprotocol.com",
};

const Zeko: MinaNetwork = {
  mina: ["https://devnet.zeko.io/graphql"],
  archive: ["https://devnet.zeko.io/graphql"],
  explorerAccountUrl: "https://zekoscan.io/devnet/account/",
  explorerTransactionUrl: "https://zekoscan.io/devnet/tx/",
  chainId: "zeko",
  name: "Zeko",
  faucet: "https://zeko.io/faucet",
};

const Lightnet: MinaNetwork = {
  mina: ["http://localhost:8080/graphql"],
  archive: ["http://localhost:8282"],
  accountManager: "http://localhost:8181",
  chainId: "lightnet",
  name: "Lightnet",
};

const networks: MinaNetwork[] = [Mainnet, Local, Devnet, Zeko, Lightnet];

/*
// not supported by o1js v1

const Berkeley: MinaNetwork = {
  mina: [
    "https://api.minascan.io/node/berkeley/v1/graphql",
    "https://proxy.berkeley.minaexplorer.com/graphql",
  ],
  archive: [
    "https://api.minascan.io/archive/berkeley/v1/graphql",
    "https://archive.berkeley.minaexplorer.com",
  ],
  explorerAccountUrl: "https://minascan.io/berkeley/account/",
  explorerTransactionUrl: "https://minascan.io/berkeley/tx/",
  chainId: "berkeley",
  name: "Berkeley",
};

const TestWorld2: MinaNetwork = {
  mina: ["https://api.minascan.io/node/testworld/v1/graphql"],
  archive: ["https://archive.testworld.minaexplorer.com"],
  explorerAccountUrl: "https://minascan.io/testworld/account/",
  explorerTransactionUrl: "https://minascan.io/testworld/tx/",
  chainId: "testworld2",
  name: "TestWorld2",
};

*/
