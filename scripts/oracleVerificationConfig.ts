export const GANACHE_CHAIN_ID = 1337;
export const SEPOLIA_CHAIN_ID = 11155111;

export const GANACHE_FEED =
  "0x3e014816C849aBD0ddf4f2D00cF4767Eb6BA0fa0";
export const GANACHE_READER =
  "0x98B084740438068F5c157e00D9c292033816E300";
export const SEPOLIA_FEED =
  "0x694AA1769357215DE4FAC081bf1f309aDC325306";

export type OracleTarget = {
  network: "ganache" | "sepolia";
  chainId: number;
  readerAddress: string;
  feedAddress: string;
  feedName: string;
};

export function resolveOracleTarget(
  networkName: string,
  chainId: number,
  sepoliaReaderAddress?: string,
): OracleTarget {
  if (networkName === "ganache" && chainId === GANACHE_CHAIN_ID) {
    return {
      network: "ganache",
      chainId,
      readerAddress: GANACHE_READER,
      feedAddress: GANACHE_FEED,
      feedName: "MockETHUSDOracle",
    };
  }

  if (networkName === "sepolia" && chainId === SEPOLIA_CHAIN_ID) {
    if (!sepoliaReaderAddress) {
      throw new Error(
        "Missing Sepolia SafeOracleReader address. Deploy first or set SEPOLIA_ORACLE_READER_ADDRESS.",
      );
    }
    return {
      network: "sepolia",
      chainId,
      readerAddress: sepoliaReaderAddress,
      feedAddress: SEPOLIA_FEED,
      feedName: "Chainlink ETH/USD",
    };
  }

  throw new Error(
    `Unsupported oracle target: Hardhat network "${networkName}" has chain ID ${chainId}. Expected ganache/1337 or sepolia/11155111.`,
  );
}
