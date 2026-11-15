import "dotenv/config";
import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable, defineConfig } from "hardhat/config";

const normalizePrivateKey = (value: string | undefined) => {
  if (!value) return undefined;
  return value.startsWith("0x") ? value : `0x${value}`;
};

const ganachePrivateKey = normalizePrivateKey(process.env.GANACHE_PRIVATE_KEY);
const sepoliaPrivateKey = normalizePrivateKey(process.env.SEPOLIA_PRIVATE_KEY);

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
    accounts: ganachePrivateKey
      ? [ganachePrivateKey]
      : [],
  },

  sepolia: {
    type: "http",
    chainType: "l1",
    url: configVariable("SEPOLIA_RPC_URL"),
    accounts: sepoliaPrivateKey
      ? [sepoliaPrivateKey]
      : [configVariable("SEPOLIA_PRIVATE_KEY")],
  },
},
});
