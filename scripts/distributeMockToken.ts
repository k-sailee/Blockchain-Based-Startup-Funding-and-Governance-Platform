import { network } from "hardhat";
import { isAddress, parseUnits } from "ethers";

const recipient = process.argv[2];
const amount = process.argv[3];

if (!recipient || !isAddress(recipient)) {
  throw new Error(
    "Usage: npx hardhat run scripts/distributeMockToken.ts --network ganache -- <recipient> <amount>",
  );
}

if (!amount || Number(amount) <= 0) {
  throw new Error("Amount must be greater than zero.");
}

const { ethers } = await network.create({
  network: "ganache",
  chainType: "l1",
});

const [deployer] = await ethers.getSigners();
const tokenAddress = process.env.MOCK_TOKEN_ADDRESS;

if (!tokenAddress || !isAddress(tokenAddress)) {
  throw new Error("Set MOCK_TOKEN_ADDRESS to the deployed local MockToken address.");
}

const token = await ethers.getContractAt("MockToken", tokenAddress, deployer);
const value = parseUnits(amount, 18);
const balance = await token.balanceOf(deployer.address);

if (balance < value) {
  throw new Error("Deployer does not have enough sfUSD to distribute.");
}

const transaction = await token.transfer(recipient, value);
await transaction.wait();

console.log(`Transferred ${amount} sfUSD to ${recipient}.`);
