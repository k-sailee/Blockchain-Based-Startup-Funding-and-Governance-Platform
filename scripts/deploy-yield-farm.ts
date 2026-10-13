import { network } from "hardhat";
import fs from "fs";
import path from "path";

const targetNetwork = process.env.HARDHAT_NETWORK || "ganache";

console.log(`Connecting to network: ${targetNetwork}...`);

const { ethers } = await network.create({
  network: targetNetwork,
  chainType: "l1",
});

const [deployer] = await ethers.getSigners();
console.log("Deployer address:", deployer.address);

const balance = await ethers.provider.getBalance(deployer.address);
console.log("Deployer balance:", ethers.formatEther(balance), "ETH");

// 1. Deploy LP Token (LPT)
console.log("Deploying LP Token (MockERC20)...");
const MockERC20 = await ethers.getContractFactory("MockERC20");
const lpToken = await MockERC20.deploy("LP Token", "LPT");
await lpToken.waitForDeployment();
const lptAddress = await lpToken.getAddress();
console.log("LP Token (LPT) deployed at:", lptAddress);

// 2. Deploy Reward Token (RWD) for Yield Farming
console.log("Deploying Reward Token (MockERC20)...");
const rwdToken = await MockERC20.deploy("Reward Token", "RWD");
await rwdToken.waitForDeployment();
const rwdAddress = await rwdToken.getAddress();
console.log("Reward Token (RWD) deployed at:", rwdAddress);

// 3. Deploy SimpleYieldFarm contract
console.log("Deploying SimpleYieldFarm...");
const SimpleYieldFarm = await ethers.getContractFactory("SimpleYieldFarm");
const yieldFarm = await SimpleYieldFarm.deploy(lptAddress, rwdAddress);
await yieldFarm.waitForDeployment();
const farmAddress = await yieldFarm.getAddress();
console.log("SimpleYieldFarm deployed at:", farmAddress);

// 4. Mint 100 LPT to deployer/test user
const initialLPT = ethers.parseEther("100");
await lpToken.mint(deployer.address, initialLPT);
console.log(`Minted 100 LPT to deployer (${deployer.address})`);

// 5. Fund the yield farm contract with 100,000 RWD
const initialRewardPool = ethers.parseEther("100000");
await rwdToken.mint(farmAddress, initialRewardPool);
console.log("Funded SimpleYieldFarm contract with 100,000 RWD");

// 6. Verify deployed configuration and balances
const lptDecimals = await lpToken.decimals();
const rwdDecimals = await rwdToken.decimals();
const deployerLptBal = await lpToken.balanceOf(deployer.address);
const farmRwdBal = await rwdToken.balanceOf(farmAddress);
const farmStakingToken = await yieldFarm.stakingToken();
const farmRewardToken = await yieldFarm.rewardToken();
const farmRewardRate = await yieldFarm.rewardRate();

console.log("\n===== VERIFICATION OF DEPLOYMENT =====");
console.log("Configured Staking Token:", farmStakingToken, farmStakingToken === lptAddress ? "✓" : "✗");
console.log("Configured Reward Token: ", farmRewardToken, farmRewardToken === rwdAddress ? "✓" : "✗");
console.log("Farm Reward Rate:        ", farmRewardRate.toString(), "(1e15 = 0.001 RWD/LPT/sec)");
console.log("Deployer LPT Balance:    ", ethers.formatUnits(deployerLptBal, lptDecimals), "LPT");
console.log("Farm RWD Pool Balance:   ", ethers.formatUnits(farmRwdBal, rwdDecimals), "RWD");
console.log("======================================\n");

// 7. Write separate Part 1 frontend configuration file
const frontendConfigPath = path.resolve("frontend/src/yieldFarmConfig.js");
const configContent = `import SimpleYieldFarm from "./contracts/SimpleYieldFarm.json";
import MockERC20 from "./contracts/MockERC20.json";

// DeFi Part 1: Yield Farming Configuration
export const CHAIN_ID = 1337;
export const RPC_URL = "http://127.0.0.1:7545";

export const YIELD_FARM_CONTRACT_ADDRESS = "${farmAddress}";
export const YIELD_FARM_CONTRACT_ABI = SimpleYieldFarm.abi;

export const LPT_TOKEN_ADDRESS = "${lptAddress}";
export const LPT_TOKEN_ABI = MockERC20.abi;

export const RWD_TOKEN_ADDRESS = "${rwdAddress}";
export const RWD_TOKEN_ABI = MockERC20.abi;
`;

fs.writeFileSync(frontendConfigPath, configContent);
console.log("Wrote separate Part 1 frontend configuration at:", frontendConfigPath);

// 8. Sync SimpleYieldFarm artifact ABI into frontend/src/contracts
const contractsDir = path.resolve("frontend/src/contracts");
const artifactPath = path.resolve("artifacts/contracts/SimpleYieldFarm.sol/SimpleYieldFarm.json");
if (fs.existsSync(artifactPath)) {
  const data = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
  fs.writeFileSync(
    path.join(contractsDir, "SimpleYieldFarm.json"),
    JSON.stringify({ abi: data.abi }, null, 2)
  );
  console.log("Synced SimpleYieldFarm ABI to frontend/src/contracts/SimpleYieldFarm.json");
}

console.log("\n--- YIELD FARM DEPLOYMENT SUMMARY ---");
console.log("Network:                 ", targetNetwork);
console.log("LP Token (LPT):          ", lptAddress);
console.log("Reward Token (RWD):      ", rwdAddress);
console.log("SimpleYieldFarm:         ", farmAddress);
console.log("Reward Rate:              0.001 RWD / LPT / sec (1e15)");
console.log("Initial LPT Minted:       100 LPT to", deployer.address);
console.log("Initial Farm Reward Pool: 100,000 RWD");
console.log("-------------------------------------\n");
