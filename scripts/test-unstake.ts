import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider(
  "http://127.0.0.1:7545"
);

const account = "0xA10989ad0b6e9BcA41693Fd588217010A5375ace";
const stakingAddress = "0x6dD510eCb840bDbB707eACa9dC937ef305d12aB3";

const stakingAbi = [
  "function unstake(uint256 amount)",
  "function stakedBalance(address) view returns (uint256)"
];

async function main() {
  const signer = new ethers.Wallet(
    "0x94f1bd2634b82458be816d47c2a394974313ba653adf0ae0f67456735f8874cb",
    provider
  );

  const staking = new ethers.Contract(
    stakingAddress,
    stakingAbi,
    signer
  );

  console.log(
    "Signer:",
    await signer.getAddress()
  );

  console.log(
    "Staked balance:",
    ethers.formatUnits(
      await staking.stakedBalance(account),
      18
    ),
    "ABC"
  );

  try {
    await staking.unstake.staticCall(
      ethers.parseUnits("100", 18)
    );

    console.log("Unstake simulation succeeded.");
  } catch (error: any) {
    console.error("Unstake simulation failed:");
    console.error(error.shortMessage || error.message);
    console.error(error.reason || "");
  }
}

main().catch(console.error);
