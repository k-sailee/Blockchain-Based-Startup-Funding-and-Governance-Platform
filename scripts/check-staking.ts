import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider(
  "http://127.0.0.1:7545"
);

const account = "0xA10989ad0b6e9BcA41693Fd588217010A5375ace";

const abcAddress = "0x6039b29433470546aa48A957217aAee90b2fFEE8";
const rwdAddress = "0x1516F80381B478202c322EeAD752E16870Ed9dae";
const stakingAddress = "0x6dD510eCb840bDbB707eACa9dC937ef305d12aB3";

const tokenAbi = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function allowance(address,address) view returns (uint256)",
  "function totalSupply() view returns (uint256)"
];

const stakingAbi = [
  "function stakedBalance(address) view returns (uint256)",
  "function earned(address) view returns (uint256)",
  "function pendingReward(address) view returns (uint256)",
  "function stakingToken() view returns (address)",
  "function rewardToken() view returns (address)",
  "function lastUpdate(address) view returns (uint256)",
  "function rewardRate() view returns (uint256)"
];

async function main() {
  const abc = new ethers.Contract(
    abcAddress,
    tokenAbi,
    provider
  );

  const rwd = new ethers.Contract(
    rwdAddress,
    tokenAbi,
    provider
  );

  const staking = new ethers.Contract(
    stakingAddress,
    stakingAbi,
    provider
  );

  const abcDecimals = await abc.decimals();
  const rwdDecimals = await rwd.decimals();
console.log("\n===== BALANCE VERIFICATION =====");

console.log(
  "ABC deployer balance:",
  ethers.formatUnits(await abc.balanceOf(account), 18)
);

console.log(
  "ABC staking contract balance:",
  ethers.formatUnits(await abc.balanceOf(stakingAddress), 18)
);

console.log(
  "ABC total supply:",
  ethers.formatUnits(await abc.totalSupply(), 18)
);
  const stakingTokenAddress = await staking.stakingToken();
  const stakingToken = new ethers.Contract(
    stakingTokenAddress,
    tokenAbi,
    provider
  );

  const [network, block] = await Promise.all([
    provider.getNetwork(),
    provider.getBlock("latest")
  ]);

  console.log("\n===== STAKING DIAGNOSTICS =====");
  console.log("Chain ID:", network.chainId.toString());
  console.log("Account:", account);

  console.log(
    "ABC wallet balance:",
    ethers.formatUnits(await abc.balanceOf(account), abcDecimals)
  );

  console.log(
    "RWD wallet balance:",
    ethers.formatUnits(await rwd.balanceOf(account), rwdDecimals)
  );

  console.log(
    "Staked ABC:",
    ethers.formatUnits(await staking.stakedBalance(account), abcDecimals)
  );

  console.log(
    "ABC held by staking contract:",
    ethers.formatUnits(
      await stakingToken.balanceOf(stakingAddress),
      abcDecimals
    )
  );

  console.log(
    "Remaining ABC allowance:",
    ethers.formatUnits(
      await abc.allowance(account, stakingAddress),
      abcDecimals
    )
  );

  console.log(
    "Pending RWD (earned):",
    ethers.formatUnits(await staking.earned(account), rwdDecimals)
  );

  console.log(
    "Stored pending reward:",
    ethers.formatUnits(
      await staking.pendingReward(account),
      rwdDecimals
    )
  );

  console.log("Staking token address:", stakingTokenAddress);
  console.log("Reward token address:", await staking.rewardToken());
  console.log("Reward rate:", (await staking.rewardRate()).toString());
  console.log("Last reward update:", (await staking.lastUpdate(account)).toString());
  console.log("Current block timestamp:", block?.timestamp);

  console.log("===============================\n");
}

main().catch((error) => {
  console.error("Diagnostic failed:", error);
  process.exitCode = 1;
});
