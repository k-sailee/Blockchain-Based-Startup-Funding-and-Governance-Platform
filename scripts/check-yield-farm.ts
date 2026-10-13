import { ethers } from "ethers";
import fs from "fs";
import path from "path";

// 1. Connect to Ganache RPC endpoint
const rpcUrl = "http://127.0.0.1:7545";
const provider = new ethers.JsonRpcProvider(rpcUrl);

// Test account / deployer
const defaultAccount = "0xA10989ad0b6e9BcA41693Fd588217010A5375ace";
const customAccount = process.argv.find(
  (arg) => arg.startsWith("0x") && arg.length === 42
);
const account = customAccount || defaultAccount;

// Dynamically load deployed addresses from frontend/src/yieldFarmConfig.js if possible
let farmAddress = "0xb2BD048B9F8d6A64b99fE76DfB5FD637b5820eFc";
let lptAddress = "0xb86E8d294E1CC6c969FA783D92452080a526839c";
let rwdAddress = "0x170d4D84982Bb1Db1955682E1FF4DA18251338a0";

try {
  const configPath = path.resolve("frontend/src/yieldFarmConfig.js");
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, "utf-8");
    const farmMatch = raw.match(/YIELD_FARM_CONTRACT_ADDRESS\s*=\s*"([^"]+)"/);
    const lptMatch = raw.match(/LPT_TOKEN_ADDRESS\s*=\s*"([^"]+)"/);
    const rwdMatch = raw.match(/RWD_TOKEN_ADDRESS\s*=\s*"([^"]+)"/);
    if (farmMatch) farmAddress = farmMatch[1];
    if (lptMatch) lptMatch && (lptAddress = lptMatch[1]);
    if (rwdMatch) rwdAddress = rwdMatch[1];
  }
} catch (e) {
  // Use fallback defaults
}

const tokenAbi = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function allowance(address,address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
];

const farmAbi = [
  "function stakingToken() view returns (address)",
  "function rewardToken() view returns (address)",
  "function rewardRate() view returns (uint256)",
  "function stakedBalance(address) view returns (uint256)",
  "function earned(address) view returns (uint256)",
  "function pendingReward(address) view returns (uint256)",
  "function lastUpdate(address) view returns (uint256)",
];

async function main() {
  const farmAddr = ethers.getAddress(farmAddress);
  const lptAddr = ethers.getAddress(lptAddress);
  const rwdAddr = ethers.getAddress(rwdAddress);
  const targetAcc = ethers.getAddress(account);

  const lpt = new ethers.Contract(lptAddr, tokenAbi, provider);
  const rwd = new ethers.Contract(rwdAddr, tokenAbi, provider);
  const farm = new ethers.Contract(farmAddr, farmAbi, provider);

  const [network, block, lptDecimals, rwdDecimals] = await Promise.all([
    provider.getNetwork(),
    provider.getBlock("latest"),
    lpt.decimals(),
    rwd.decimals(),
  ]);

  const [
    lptWalletBal,
    lptFarmBal,
    lptSupply,
    lptAllowance,
    userStaked,
    userEarned,
    userPending,
    rwdWalletBal,
    rwdFarmBal,
    rewardRate,
    lastUpdate,
    stakingTokenAddr,
    rewardTokenAddr,
  ] = await Promise.all([
    lpt.balanceOf(targetAcc),
    lpt.balanceOf(farmAddr),
    lpt.totalSupply(),
    lpt.allowance(targetAcc, farmAddr),
    farm.stakedBalance(targetAcc),
    farm.earned(targetAcc),
    farm.pendingReward(targetAcc),
    rwd.balanceOf(targetAcc),
    rwd.balanceOf(farmAddr),
    farm.rewardRate(),
    farm.lastUpdate(targetAcc),
    farm.stakingToken(),
    farm.rewardToken(),
  ]);

  console.log("\n========================================================");
  console.log("       DEFI EXPERIMENT 5 - PART 1: YIELD FARM CHECK     ");
  console.log("========================================================");
  console.log("Chain ID:                       ", network.chainId.toString());
  console.log("Test Account:                   ", account);
  console.log("Latest Block Timestamp:         ", block?.timestamp);
  console.log("--------------------------------------------------------");
  console.log("Configured Staking Token (LPT): ", stakingTokenAddr);
  console.log("Configured Reward Token (RWD):  ", rewardTokenAddr);
  console.log("Yield Farm Contract:            ", farmAddress);
  console.log("Reward Rate (scaled 1e18):      ", rewardRate.toString(), "(0.001 RWD/LPT/sec)");
  console.log("--------------------------------------------------------");
  console.log("LPT Wallet Balance:             ", ethers.formatUnits(lptWalletBal, lptDecimals), "LPT");
  console.log("LPT Balance Held by Farm:       ", ethers.formatUnits(lptFarmBal, lptDecimals), "LPT");
  console.log("LPT Total Supply:               ", ethers.formatUnits(lptSupply, lptDecimals), "LPT");
  console.log("Remaining LPT Allowance to Farm:", ethers.formatUnits(lptAllowance, lptDecimals), "LPT");
  console.log("--------------------------------------------------------");
  console.log("User Recorded Staked Balance:   ", ethers.formatUnits(userStaked, lptDecimals), "LPT");
  console.log("User Earned RWD (Current):      ", ethers.formatUnits(userEarned, rwdDecimals), "RWD");
  console.log("User Stored Pending Reward:     ", ethers.formatUnits(userPending, rwdDecimals), "RWD");
  console.log("User Last Reward Update:        ", lastUpdate.toString());
  console.log("--------------------------------------------------------");
  console.log("RWD Wallet Balance:             ", ethers.formatUnits(rwdWalletBal, rwdDecimals), "RWD");
  console.log("RWD Balance Held by Farm (Pool):", ethers.formatUnits(rwdFarmBal, rwdDecimals), "RWD");
  console.log("========================================================\n");
}

main().catch((error) => {
  console.error("Diagnostic failed:", error);
  process.exitCode = 1;
});
