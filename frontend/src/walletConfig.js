
import { createAppKit } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

export const walletConnectEnabled = Boolean(projectId);

const networks = [
  {
    id: 1337,
    caipNetworkId: "eip155:1337",
    chainNamespace: "eip155",
    name: "Ganache",
    nativeCurrency: { decimals: 18, name: "Ganache Ether", symbol: "ETH" },
    rpcUrls: { default: { http: ["http://127.0.0.1:7545"] } },
  },
  {
    id: 11155111,
    caipNetworkId: "eip155:11155111",
    chainNamespace: "eip155",
    name: "Sepolia",
    nativeCurrency: {
      decimals: 18,
      name: "Sepolia Ether",
      symbol: "ETH",
    },
    rpcUrls: {
      default: {
        http: ["https://ethereum-sepolia-rpc.publicnode.com"],
      },
    },
    blockExplorers: {
      default: {
        name: "Etherscan",
        url: "https://sepolia.etherscan.io",
      },
    },
  },
];

if (walletConnectEnabled) {
  createAppKit({
    adapters: [new EthersAdapter()],
    networks,
    projectId,
    metadata: {
      name: "StartFund",
      description: "Decentralized Startup Funding",
      url: window.location.origin,
      icons: [],
    },
    features: {
      analytics: false,
    },
  });
}
