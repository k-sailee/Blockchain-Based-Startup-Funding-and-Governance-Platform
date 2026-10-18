
import { createAppKit } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

if (!projectId) {
  throw new Error(
    "Missing VITE_WALLETCONNECT_PROJECT_ID in frontend/.env.local"
  );
}

const networks = [
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
