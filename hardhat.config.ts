import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    profiles: {
      default: {
  version: "0.8.28",
  settings: {
    evmVersion: "paris",
  },
},
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
  hardhatMainnet: {
    type: "edr-simulated",
    chainType: "l1",
  },

  hardhatOp: {
    type: "edr-simulated",
    chainType: "op",
  },

  ganache: {
    type: "http",
    chainType: "l1",
    url: "http://127.0.0.1:7545",
    accounts: [
      "0x956cb5f95a9704015aab6dbdd335d24a4b4a232a9fc6804392475d3d713ca294"
    ],
  },

  sepolia: {
    type: "http",
    chainType: "l1",
    url: configVariable("SEPOLIA_RPC_URL"),
    accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
  },
},
});
