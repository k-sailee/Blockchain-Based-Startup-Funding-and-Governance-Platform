
const { ethers } = require("ethers");

const RPC_URL = "http://127.0.0.1:7545";
const FARM_ADDRESS = "0xC6009E2c01709EaEA50d8B11E5c8c4992EF3A5B7";

// Minimal ABI: only the functions needed for this diagnostic.
const ABI = [
  "function earned(address) view returns (uint256)",
  "function stakedBalance(address) view returns (uint256)",
  "function lastUpdate(address) view returns (uint256)",
  "function rewardRate() view returns (uint256)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  // Read the account from the first unlocked Ganache account.
  const accounts = await provider.send("eth_accounts", []);
  const account = accounts[0];

  if (!account) {
    throw new Error("No unlocked Ganache account found.");
  }

  const farm = new ethers.Contract(FARM_ADDRESS, ABI, provider);

  const beforeBlock = await provider.getBlock("latest");
  const beforeEarned = await farm.earned(account);
  const lastUpdate = await farm.lastUpdate(account);

  console.log("Account:", account);
  console.log("Timestamp before:", beforeBlock.timestamp);
  console.log("Last update:", lastUpdate.toString());
  console.log("Earned before:", ethers.formatEther(beforeEarned), "RWD");

  await provider.send("evm_increaseTime", [60]);
  await provider.send("evm_mine", []);

  const afterBlock = await provider.getBlock("latest");
  const afterEarned = await farm.earned(account);

  console.log("Timestamp after:", afterBlock.timestamp);
  console.log("Earned after:", ethers.formatEther(afterEarned), "RWD");

  await provider.destroy();
}

main().catch(console.error);
