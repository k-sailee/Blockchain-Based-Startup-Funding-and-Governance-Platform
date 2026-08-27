import { createAppKit } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { sepolia } from "@reown/appkit/networks";

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

const metadata = {
  name: "StartFund",
  description: "Blockchain Startup Funding DApp",
  url: "http://localhost:5173",
  icons: []
};

createAppKit({
  adapters: [new EthersAdapter()],
  projectId,
  metadata,
  networks: [sepolia],
  defaultNetwork: sepolia,
  enableAnalytics: false
});