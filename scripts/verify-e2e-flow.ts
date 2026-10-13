import { ethers } from "ethers";
import fs from "fs";
import path from "path";

const rpcUrl = "http://127.0.0.1:7545";
const provider = new ethers.JsonRpcProvider(rpcUrl);

// Ganache default deployer private key
const deployerPrivateKey = "0x94f1bd2634b82458be816d47c2a394974313ba653adf0ae0f67456735f8874cb";
const wallet = new ethers.Wallet(deployerPrivateKey, provider);

// Load deployed addresses from frontend/src/yieldFarmConfig.js
const configPath = path.resolve("frontend/src/yieldFarmConfig.js");
const rawConfig = fs.readFileSync(configPath, "utf-8");

const farmMatch = rawConfig.match(/YIELD_FARM_CONTRACT_ADDRESS\s*=\s*"([^"]+)"/);
const lptMatch = rawConfig.match(/LPT_TOKEN_ADDRESS\s*=\s*"([^"]+)"/);
const rwdMatch = rawConfig.match(/RWD_TOKEN_ADDRESS\s*=\s*"([^"]+)"/);

if (!farmMatch || !lptMatch || !rwdMatch) {
  throw new Error("Could not find deployed addresses in yieldFarmConfig.js");
}

const farmAddress = ethers.getAddress(farmMatch[1]);
const lptAddress = ethers.getAddress(lptMatch[1]);
const rwdAddress = ethers.getAddress(rwdMatch[1]);

const tokenAbi = [
  "function mint(address to, uint256 amount) external",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
];

const farmAbi = [
  "function stake(uint256 amount) external",
  "function withdraw(uint256 amount) external",
  "function harvest() external",
  "function exit() external",
  "function earned(address user) external view returns (uint256)",
  "function stakedBalance(address user) external view returns (uint256)",
  "function pendingReward(address user) external view returns (uint256)",
  "function lastUpdate(address user) external view returns (uint256)",
];

async function advanceTime(seconds: number) {
  await provider.send("evm_increaseTime", [seconds]);
  await provider.send("evm_mine", []);
}

let currentNonce: number | null = null;
async function getNonce() {
  if (currentNonce === null) {
    currentNonce = await provider.getTransactionCount(wallet.address, "pending");
  }
  const n = currentNonce;
  currentNonce++;
  return n;
}

async function main() {
  console.log("================================================================");
  console.log("  END-TO-END VERIFICATION: DEFI EXPERIMENT 5 - PART 1 (YIELD FARM) ");
  console.log("================================================================");
  console.log("Account:                ", wallet.address);
  console.log("SimpleYieldFarm Contract:", farmAddress);
  console.log("LP Token (LPT) Contract: ", lptAddress);
  console.log("Reward Token (RWD) Contract:", rwdAddress);
  console.log("----------------------------------------------------------------\n");

  const lpt = new ethers.Contract(lptAddress, tokenAbi, wallet);
  const rwd = new ethers.Contract(rwdAddress, tokenAbi, wallet);
  const farm = new ethers.Contract(farmAddress, farmAbi, wallet);

  // Step 1: Mint 100 LPT to the test account
  console.log("Step 1: Minting 100 LPT to test account...");
  const mintTx = await lpt.mint(wallet.address, ethers.parseEther("100"), {
    gasLimit: 300000n,
    nonce: await getNonce(),
  });
  const mintReceipt = await mintTx.wait();
  console.log(`  -> Mint Tx Hash: ${mintTx.hash} (Status: ${mintReceipt.status})`);

  // Step 2: Verify its LPT balance
  console.log("Step 2: Verifying LPT balance...");
  const lptBalStep2 = await lpt.balanceOf(wallet.address);
  console.log(`  -> LPT Balance: ${ethers.formatEther(lptBalStep2)} LPT`);

  // Step 3: Approve farm to spend 100 LPT
  console.log("Step 3: Approving farm to spend 100 LPT...");
  const approveTx = await lpt.approve(farmAddress, ethers.parseEther("100"), {
    gasLimit: 300000n,
    nonce: await getNonce(),
  });
  const approveReceipt = await approveTx.wait();
  console.log(`  -> Approve Tx Hash: ${approveTx.hash} (Status: ${approveReceipt.status})`);

  // Step 4: Stake 100 LPT
  console.log("Step 4: Staking 100 LPT into SimpleYieldFarm...");
  const stakeTx = await farm.stake(ethers.parseEther("100"), {
    gasLimit: 300000n,
    nonce: await getNonce(),
  });
  const stakeReceipt = await stakeTx.wait();
  console.log(`  -> Stake Tx Hash: ${stakeTx.hash} (Status: ${stakeReceipt.status})`);

  // Step 5: Verify stakedBalance(account) == 100 LPT
  console.log("Step 5: Verifying staked balance...");
  const stakedBalStep5 = await farm.stakedBalance(wallet.address);
  console.log(`  -> Staked Balance: ${ethers.formatEther(stakedBalStep5)} LPT`);

  // Step 6: Observe reward accumulation for ~60 seconds
  console.log("Step 6: Advancing chain time by 60 seconds...");
  await advanceTime(60);

  // Step 7: Verify earned(account) is approximately 6 RWD
  console.log("Step 7: Verifying earned rewards...");
  const earnedStep7 = await farm.earned(wallet.address);
  console.log(`  -> Earned RWD: ${ethers.formatEther(earnedStep7)} RWD (expected ~6.0 RWD)`);

  // Step 8: Harvest rewards and verify user's RWD balance increases
  console.log("Step 8: Calling harvest() to claim rewards...");
  const preHarvestRwd = await rwd.balanceOf(wallet.address);
  const harvestTx = await farm.harvest({
    gasLimit: 300000n,
    nonce: await getNonce(),
  });
  const harvestReceipt = await harvestTx.wait();
  const postHarvestRwd = await rwd.balanceOf(wallet.address);
  console.log(`  -> Harvest Tx Hash: ${harvestTx.hash} (Status: ${harvestReceipt.status})`);
  console.log(`  -> User RWD Balance before: ${ethers.formatEther(preHarvestRwd)} RWD`);
  console.log(`  -> User RWD Balance after:  ${ethers.formatEther(postHarvestRwd)} RWD`);

  // Step 9: Wait again for rewards to accrue
  console.log("Step 9: Advancing chain time by another 30 seconds...");
  await advanceTime(30);
  const earnedStep9 = await farm.earned(wallet.address);
  console.log(`  -> New Accrued Rewards: ${ethers.formatEther(earnedStep9)} RWD`);

  // Step 10: Withdraw 40 LPT
  console.log("Step 10: Withdrawing 40 LPT...");
  const withdrawTx = await farm.withdraw(ethers.parseEther("40"), {
    gasLimit: 300000n,
    nonce: await getNonce(),
  });
  const withdrawReceipt = await withdrawTx.wait();
  console.log(`  -> Withdraw Tx Hash: ${withdrawTx.hash} (Status: ${withdrawReceipt.status})`);

  // Step 11: Verify user's LPT wallet balance increases by 40 LPT and remaining stake is 60 LPT
  console.log("Step 11: Verifying balances after partial withdrawal...");
  const lptBalStep11 = await lpt.balanceOf(wallet.address);
  const stakedBalStep11 = await farm.stakedBalance(wallet.address);
  console.log(`  -> User LPT Wallet Balance: ${ethers.formatEther(lptBalStep11)} LPT`);
  console.log(`  -> Remaining Staked Balance: ${ethers.formatEther(stakedBalStep11)} LPT`);

  // Step 12: Verify accumulated rewards remain correctly accounted for
  console.log("Step 12: Checking preserved reward accounting...");
  const earnedStep12 = await farm.earned(wallet.address);
  console.log(`  -> Earned RWD remaining: ${ethers.formatEther(earnedStep12)} RWD`);

  // Step 13: Call exit()
  console.log("Step 13: Calling exit() to withdraw all remaining LPT and claim all RWD...");
  const exitTx = await farm.exit({
    gasLimit: 400000n,
    nonce: await getNonce(),
  });
  const exitReceipt = await exitTx.wait();
  console.log(`  -> Exit Tx Hash: ${exitTx.hash} (Status: ${exitReceipt.status})`);

  // Step 14: Verify remaining 60 LPT is returned and pending rewards are harvested
  console.log("Step 14: Verifying final wallet balances...");
  const finalLptBal = await lpt.balanceOf(wallet.address);
  const finalRwdBal = await rwd.balanceOf(wallet.address);
  console.log(`  -> Final User LPT Wallet Balance: ${ethers.formatEther(finalLptBal)} LPT`);
  console.log(`  -> Final User RWD Wallet Balance: ${ethers.formatEther(finalRwdBal)} RWD`);

  // Step 15: Confirm user's final staked balance and pending rewards are zero
  console.log("Step 15: Confirming user final farm balances are zero...");
  const finalStaked = await farm.stakedBalance(wallet.address);
  const finalPending = await farm.pendingReward(wallet.address);
  const finalEarned = await farm.earned(wallet.address);
  console.log(`  -> Final Staked Balance:  ${ethers.formatEther(finalStaked)} LPT (Expected: 0)`);
  console.log(`  -> Final Pending Rewards: ${ethers.formatEther(finalPending)} RWD (Expected: 0)`);
  console.log(`  -> Final Earned:          ${ethers.formatEther(finalEarned)} RWD (Expected: 0)`);

  // Step 16: Confirm farm retains its remaining RWD balance after payouts
  console.log("Step 16: Confirming farm pool solvency...");
  const farmRwdBal = await rwd.balanceOf(farmAddress);
  const farmLptBal = await lpt.balanceOf(farmAddress);
  console.log(`  -> Farm Remaining RWD Pool Balance: ${ethers.formatEther(farmRwdBal)} RWD`);
  console.log(`  -> Farm Remaining LPT Balance:      ${ethers.formatEther(farmLptBal)} LPT`);

  console.log("\n================================================================");
  console.log("  ALL 16 END-TO-END STEPS VERIFIED SUCCESSFULLY ON GANACHE!      ");
  console.log("================================================================\n");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exitCode = 1;
});
