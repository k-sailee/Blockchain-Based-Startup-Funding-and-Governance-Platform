import { network } from "hardhat";

const { ethers } = await network.create({
  network: "ganache",
  chainType: "l1",
});

console.log("Deploying StartupFunding to Ganache...");

const [deployer] = await ethers.getSigners();

console.log("Deployer address:", deployer.address);

const balance = await ethers.provider.getBalance(deployer.address);

console.log(
  "Deployer balance:",
  ethers.formatEther(balance),
  "ETH"
);

const StartupFunding = await ethers.getContractFactory("StartupFunding");

const startupFunding = await StartupFunding.deploy();

await startupFunding.waitForDeployment();

const contractAddress = await startupFunding.getAddress();

console.log("StartupFunding deployed successfully!");
console.log("Contract address:", contractAddress);