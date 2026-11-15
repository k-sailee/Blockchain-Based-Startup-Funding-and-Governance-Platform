import { network } from "hardhat";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AbiCoder, Contract, getCreateAddress } from "ethers";

const SEPOLIA_CHAIN_ID = 11155111;
const SEPOLIA_FEED = "0x694AA1769357215DE4FAC081bf1f309aDC325306";
const targetNetwork = process.env.HARDHAT_NETWORK || "sepolia";

if (targetNetwork !== "sepolia") {
  throw new Error("deployChainlink.ts only deploys to the configured Sepolia network.");
}

const { ethers } = await network.create({ network: targetNetwork, chainType: "l1" });
const providerNetwork = await ethers.provider.getNetwork();
if (Number(providerNetwork.chainId) !== SEPOLIA_CHAIN_ID) {
  throw new Error(`Expected Sepolia (${SEPOLIA_CHAIN_ID}), received ${providerNetwork.chainId}.`);
}

const [deployer] = await ethers.getSigners();
const balance = await ethers.provider.getBalance(deployer.address);
if (balance === 0n) throw new Error("Deployer has no Sepolia ETH for gas.");

const artifact = JSON.parse(
  readFileSync(
    join(process.cwd(), "artifacts/contracts/SafeOracleReader.sol/SafeOracleReader.json"),
    "utf8",
  ),
);
const constructorArgs = AbiCoder.defaultAbiCoder().encode(
  ["address", "uint256"],
  [SEPOLIA_FEED, 3600],
);
const deploymentNonce = await deployer.getNonce();
const deploymentTransaction = await deployer.sendTransaction({
  data: `${artifact.bytecode}${constructorArgs.slice(2)}`,
});
const deploymentReceipt = await deploymentTransaction.wait();
if (!deploymentReceipt) throw new Error("Sepolia deployment receipt was not returned.");
const address = getCreateAddress({
  from: deployer.address,
  nonce: deploymentNonce,
});
const reader = new Contract(address, artifact.abi, deployer);
const data = await reader.latestPriceData();

if (data[0] <= 0n || data[2] === 0n) {
  throw new Error("Sepolia Chainlink feed returned invalid data.");
}

const deployment = {
  chainId: SEPOLIA_CHAIN_ID,
  network: "sepolia",
  deployer: deployer.address,
  feed: SEPOLIA_FEED,
  safeOracleReader: address,
  feedDecimals: Number(data[1]),
  description: data[3],
  lastUpdated: data[2].toString(),
  verifiedAt: new Date().toISOString(),
};

const outputDir = join(process.cwd(), "deployments");
mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, "sepolia-chainlink.json"), `${JSON.stringify(deployment, null, 2)}\n`);
console.log(JSON.stringify(deployment, null, 2));
