import { network } from "hardhat";
import fs from "fs";
import path from "path";

const targetNetwork = process.env.HARDHAT_NETWORK || "ganache";

const { ethers } = await network.create({
  network: targetNetwork,
  chainType: "l1",
});

console.log(`Connecting to network: ${targetNetwork}...`);

const [deployer] = await ethers.getSigners();
console.log("Deployer address:", deployer.address);

const balance = await ethers.provider.getBalance(deployer.address);
console.log("Deployer balance:", ethers.formatEther(balance), "ETH");

// 1. Deploy StartupFunding (preserving existing deployment flow)
console.log("Deploying StartupFunding...");
const StartupFunding = await ethers.getContractFactory("StartupFunding");
const startupFunding = await StartupFunding.deploy();
await startupFunding.waitForDeployment();
const startupFundingAddress = await startupFunding.getAddress();
console.log("StartupFunding deployed at:", startupFundingAddress);

// 2. Deploy ABC protocol token
console.log("Deploying ABC Protocol Token (MockERC20)...");
const MockERC20 = await ethers.getContractFactory("MockERC20");
const abcToken = await MockERC20.deploy("ABC Protocol Token", "ABC");
await abcToken.waitForDeployment();
const abcAddress = await abcToken.getAddress();
console.log("ABC Token deployed at:", abcAddress);

// 3. Deploy RWD reward token
console.log("Deploying RWD Reward Token (MockERC20)...");
const rwdToken = await MockERC20.deploy("Reward Token", "RWD");
await rwdToken.waitForDeployment();
const rwdAddress = await rwdToken.getAddress();
console.log("RWD Token deployed at:", rwdAddress);

// 4. Deploy SimpleStaking contract
console.log("Deploying SimpleStaking...");
const SimpleStaking = await ethers.getContractFactory("SimpleStaking");
const simpleStaking = await SimpleStaking.deploy(abcAddress, rwdAddress);
await simpleStaking.waitForDeployment();
const stakingAddress = await simpleStaking.getAddress();
console.log("SimpleStaking deployed at:", stakingAddress);

// 5. Mint test ABC tokens to deployer account for local testing
const initialABC = ethers.parseEther("10000"); // 10,000 ABC
await abcToken.mint(deployer.address, initialABC);
console.log(`Minted 10,000 ABC to deployer (${deployer.address})`);

// 6. Fund the staking contract with sufficient RWD tokens
const initialRewardFund = ethers.parseEther("100000"); // 100,000 RWD
await rwdToken.mint(stakingAddress, initialRewardFund);
console.log(`Funded SimpleStaking contract with 100,000 RWD`);

// 7. Write updated contract config to frontend
const frontendConfigPath = path.resolve("frontend/src/contractConfig.js");
const configContent = `import StartupFunding from "./contracts/StartupFunding.json";
import SimpleStaking from "./contracts/SimpleStaking.json";
import MockERC20 from "./contracts/MockERC20.json";

// Startup Funding contract (existing)
export const CONTRACT_ADDRESS = "${startupFundingAddress}";
export const CONTRACT_ABI = StartupFunding.abi;

// Part 2: Staking and Token contracts
export const STAKING_CONTRACT_ADDRESS = "${stakingAddress}";
export const STAKING_CONTRACT_ABI = SimpleStaking.abi;

export const ABC_TOKEN_ADDRESS = "${abcAddress}";
export const ABC_TOKEN_ABI = MockERC20.abi;

export const RWD_TOKEN_ADDRESS = "${rwdAddress}";
export const RWD_TOKEN_ABI = MockERC20.abi;
`;

fs.writeFileSync(frontendConfigPath, configContent);
console.log("Updated frontend contract configuration at:", frontendConfigPath);

// Sync ABIs into frontend/src/contracts
const contractsDir = path.resolve("frontend/src/contracts");
const copyAbi = (contractName: string, sourceArtifact: string) => {
  const artifactPath = path.resolve(`artifacts/contracts/${sourceArtifact}/${contractName}.json`);
  if (fs.existsSync(artifactPath)) {
    const data = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
    fs.writeFileSync(
      path.join(contractsDir, `${contractName}.json`),
      JSON.stringify({ abi: data.abi }, null, 2)
    );
  }
};

copyAbi("StartupFunding", "StartupFunding.sol");
copyAbi("SimpleStaking", "SimpleStaking.sol");
copyAbi("MockERC20", "MockERC20.sol");
console.log("Synced ABIs to frontend/src/contracts");

console.log("\n--- DEPLOYMENT SUMMARY ---");
console.log("Network:            ", targetNetwork);
console.log("StartupFunding:     ", startupFundingAddress);
console.log("ABC Token:          ", abcAddress);
console.log("RWD Token:          ", rwdAddress);
console.log("SimpleStaking:      ", stakingAddress);
console.log("Staking Reward Rate: 0.001 RWD / ABC / sec (1e15)");
console.log("---------------------------\n");