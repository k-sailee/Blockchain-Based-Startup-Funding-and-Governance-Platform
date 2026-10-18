import { network } from "hardhat";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const { ethers } = await network.create({
  network: "ganache",
  chainType: "l1",
});
const [deployer] = await ethers.getSigners();
const weth = await ethers.deployContract("WETH9");
const usdc = await ethers.deployContract("MockUSDC");
const oracle = await ethers.deployContract("MockETHUSDOracle", [2500n * 10n ** 8n]);
const reader = await ethers.deployContract("SafeOracleReader", [await oracle.getAddress(), 3600]);
const pool = await ethers.deployContract("AMMPool", [await weth.getAddress(), await usdc.getAddress()]);
await Promise.all([weth.waitForDeployment(), usdc.waitForDeployment(), oracle.waitForDeployment(), reader.waitForDeployment(), pool.waitForDeployment()]);
const addresses = {
  chainId: 1337,
  deployer: deployer.address,
  WETH9: await weth.getAddress(),
  MockUSDC: await usdc.getAddress(),
  AMMPool: await pool.getAddress(),
  MockETHUSDOracle: await oracle.getAddress(),
  SafeOracleReader: await reader.getAddress(),
};
mkdirSync(join(process.cwd(), "frontend", "src"), { recursive: true });
writeFileSync(join(process.cwd(), "frontend", "src", "dexConfig.js"), `export const DEX_CONFIG = ${JSON.stringify(addresses, null, 2)};\n`);
console.log(JSON.stringify(addresses, null, 2));
