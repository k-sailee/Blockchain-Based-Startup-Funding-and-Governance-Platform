import { network } from "hardhat";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Contract, isAddress } from "ethers";
import {
  resolveOracleTarget,
  SEPOLIA_CHAIN_ID,
} from "./oracleVerificationConfig.js";

const deploymentPath = join(
  process.cwd(),
  "deployments",
  "sepolia-chainlink.json",
);

function formatError(error: unknown) {
  if (error && typeof error === "object" && "shortMessage" in error) {
    return String(error.shortMessage);
  }
  return error instanceof Error ? error.message : String(error);
}

const connection = await network.create({ chainType: "l1" });
const { ethers } = connection;
const providerChainHex = await ethers.provider.send("eth_chainId", []);
const chainId = Number.parseInt(providerChainHex, 16);
const networkName = connection.networkName;

const deployment =
  networkName === "sepolia" && existsSync(deploymentPath)
    ? JSON.parse(readFileSync(deploymentPath, "utf8"))
    : undefined;
const sepoliaReaderAddress =
  process.env.SEPOLIA_ORACLE_READER_ADDRESS || deployment?.safeOracleReader;

let target;
try {
  target = resolveOracleTarget(networkName, chainId, sepoliaReaderAddress);
} catch (error) {
  throw new Error(formatError(error));
}

if (!isAddress(target.readerAddress) || !isAddress(target.feedAddress)) {
  throw new Error(
    `Invalid ${target.network} deployment address: reader=${target.readerAddress}, feed=${target.feedAddress}.`,
  );
}

const reader = new Contract(
  target.readerAddress,
  [
    "function feed() view returns(address)",
    "function feedDecimals() view returns(uint8)",
    "function maxAge() view returns(uint256)",
    "function latestPriceData() view returns(uint256,uint8,uint256,string)",
  ],
  ethers.provider,
);
const feed = new Contract(
  target.feedAddress,
  [
    "function decimals() view returns(uint8)",
    "function description() view returns(string)",
  ],
  ethers.provider,
);

try {
  const [readerFeed, readerDecimals, maxAge, priceData, feedDecimals, description] =
    await Promise.all([
      reader.feed(),
      reader.feedDecimals(),
      reader.maxAge(),
      reader.latestPriceData(),
      feed.decimals(),
      feed.description(),
    ]);

  const latestBlock = await ethers.provider.getBlock("latest");
  if (!latestBlock) {
    throw new Error("Unable to read the latest block timestamp.");
  }
  const now = Number(latestBlock.timestamp);
  const updatedAt = Number(priceData[2]);
  const age = now - updatedAt;
  const feedMatches = readerFeed.toLowerCase() === target.feedAddress.toLowerCase();
  const decimalsMatch = Number(readerDecimals) === Number(feedDecimals);
  const validPrice = priceData[0] > 0n;
  const validTimestamp = updatedAt > 0 && age >= 0;
  const fresh = validTimestamp && BigInt(age) <= maxAge;

  if (!feedMatches) {
    throw new Error(
      `Reader points to ${readerFeed}, not the configured ${target.feedName} feed ${target.feedAddress}.`,
    );
  }
  if (!decimalsMatch) {
    throw new Error("Reader decimals do not match the live feed decimals.");
  }
  if (!validPrice || !validTimestamp || !fresh) {
    throw new Error(
      `Oracle validation failed: positivePrice=${validPrice}, validTimestamp=${validTimestamp}, fresh=${fresh}.`,
    );
  }

  console.log(
    JSON.stringify(
      {
        network: networkName,
        chainId,
        reader: target.readerAddress,
        feed: target.feedAddress,
        feedName: target.feedName,
        price: priceData[0].toString(),
        decimals: Number(priceData[1]),
        description,
        updatedAt,
        ageSeconds: age,
        maxAgeSeconds: maxAge.toString(),
        validation: {
          readerFeed: feedMatches,
          decimals: decimalsMatch,
          positivePrice: validPrice,
          validTimestamp,
          fresh,
        },
        status: "validated",
      },
      null,
      2,
    ),
  );
} catch (error) {
  throw new Error(
    `${networkName} oracle verification failed for reader ${target.readerAddress}: ${formatError(error)}`,
  );
}
