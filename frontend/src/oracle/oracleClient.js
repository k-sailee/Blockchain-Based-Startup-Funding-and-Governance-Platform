import { Contract, formatUnits, parseUnits } from "ethers";
import { getOracleNetwork } from "../config/oracleConfig";

const READER_ABI = [
  "function latestPriceData() view returns(uint256,uint8,uint256,string)",
  "function ethToUsd(uint256) view returns(uint256)",
];

export function getNetworkConfig(chainId) {
  return getOracleNetwork(chainId);
}

export async function readOracle(provider, chainId) {
  const config = getNetworkConfig(chainId);
  if (!config) {
    throw new Error(`Unsupported network (chain ${chainId}). Switch to Ganache or Sepolia.`);
  }
  if (!config.readerAddress) {
    throw new Error(`${config.name} oracle reader address is not configured.`);
  }

  const reader = new Contract(config.readerAddress, READER_ABI, provider);
  const [price, decimals, updatedAt, description] = await reader.latestPriceData();
  const age = Math.max(0, Math.floor(Date.now() / 1000) - Number(updatedAt));
  return {
    ...config,
    price,
    priceFormatted: formatUnits(price, decimals),
    decimals: Number(decimals),
    updatedAt: Number(updatedAt),
    updatedLabel: new Date(Number(updatedAt) * 1000).toLocaleString(),
    age,
    fresh: age <= 3600,
    description,
    reader,
  };
}

export async function convertEthToUsd(provider, chainId, ethAmount) {
  const oracle = await readOracle(provider, chainId);
  const usd = await oracle.reader.ethToUsd(parseUnits(ethAmount || "0", 18));
  return {
    ...oracle,
    usd,
    usdFormatted: formatUnits(usd, 18),
  };
}
