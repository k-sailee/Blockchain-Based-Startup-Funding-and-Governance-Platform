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
      "0x1b71111a7891bab3c678188644ac96b0ba1fd7f632d1036e7febf431f3182bbb"
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
