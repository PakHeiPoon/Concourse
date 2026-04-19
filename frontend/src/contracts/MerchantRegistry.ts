export const MERCHANT_REGISTRY_ADDRESS = "0x18B9AbB94eeaCbAbc6bFECB7143165AF6E0df543";

export const MERCHANT_REGISTRY_ABI = [
  {
    inputs: [
      { internalType: "string", name: "_did", type: "string" },
      { internalType: "string", name: "_merchantType", type: "string" },
      { internalType: "string", name: "_profileHash", type: "string" },
      { internalType: "string", name: "_profileURI", type: "string" },
      { internalType: "string", name: "_skillEndpoint", type: "string" },
    ],
    name: "register",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "_did", type: "string" }],
    name: "getMerchant",
    outputs: [
      {
        components: [
          { internalType: "address", name: "owner", type: "address" },
          { internalType: "string", name: "did", type: "string" },
          { internalType: "string", name: "merchantType", type: "string" },
          { internalType: "string", name: "profileHash", type: "string" },
          { internalType: "string", name: "profileURI", type: "string" },
          { internalType: "string", name: "skillEndpoint", type: "string" },
          { internalType: "uint256", name: "registeredAt", type: "uint256" },
          { internalType: "uint256", name: "updatedAt", type: "uint256" },
          { internalType: "bool", name: "active", type: "bool" },
        ],
        internalType: "struct MerchantRegistry.MerchantIdentity",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string", name: "_merchantType", type: "string" },
      { internalType: "uint256", name: "offset", type: "uint256" },
      { internalType: "uint256", name: "limit", type: "uint256" },
    ],
    name: "listByType",
    outputs: [
      {
        components: [
          { internalType: "address", name: "owner", type: "address" },
          { internalType: "string", name: "did", type: "string" },
          { internalType: "string", name: "merchantType", type: "string" },
          { internalType: "string", name: "profileHash", type: "string" },
          { internalType: "string", name: "profileURI", type: "string" },
          { internalType: "string", name: "skillEndpoint", type: "string" },
          { internalType: "uint256", name: "registeredAt", type: "uint256" },
          { internalType: "uint256", name: "updatedAt", type: "uint256" },
          { internalType: "bool", name: "active", type: "bool" },
        ],
        internalType: "struct MerchantRegistry.MerchantIdentity[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "string", name: "did", type: "string" },
      { indexed: true, internalType: "address", name: "owner", type: "address" },
      { indexed: false, internalType: "string", name: "merchantType", type: "string" },
    ],
    name: "MerchantRegistered",
    type: "event",
  },
] as const;

export const ZERO_G_CHAIN = {
  chainId: 16602,
  name: "0G Testnet",
  rpcUrl: "https://evmrpc-testnet.0g.ai",
  explorerUrl: "https://chainscan-galileo.0g.ai",
};
