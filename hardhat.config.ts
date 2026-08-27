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
      "0xa47f7c547a0f61101426e12ac1fd5acb03cc3127b9bce4df98a6651a4e1fb619"
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
