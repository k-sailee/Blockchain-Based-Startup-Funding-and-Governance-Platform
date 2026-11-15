import StartupFunding from "../contracts/StartupFunding.json";
import SafeOracleReader from "../contracts/SafeOracleReader.json";
import { DEX_CONFIG } from "../dexConfig";
import { CONTRACT_ADDRESS } from "../contractConfig";

export const ORACLE_NETWORKS = {
  1337: {
    name: "Ganache",
    chainId: 1337,
    feedType: "MockETHUSDOracle",
    feedAddress: DEX_CONFIG.MockETHUSDOracle,
    readerAddress: DEX_CONFIG.SafeOracleReader,
    fundingAddress: CONTRACT_ADDRESS,
    readerAbi: SafeOracleReader.abi,
    fundingAbi: StartupFunding.abi,
  },
  11155111: {
    name: "Sepolia",
    chainId: 11155111,
    feedType: "Chainlink ETH/USD",
    feedAddress: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
    readerAddress:
      import.meta.env.VITE_SEPOLIA_ORACLE_READER_ADDRESS ||
      "0x9e78cDB124703E57686E9363D3B152E2cE99e1f8",
    fundingAddress: import.meta.env.VITE_SEPOLIA_STARTUP_FUNDING_ADDRESS || "",
    readerAbi: SafeOracleReader.abi,
    fundingAbi: StartupFunding.abi,
  },
};

export function getOracleNetwork(chainId) {
  return ORACLE_NETWORKS[Number(chainId)] || null;
}
