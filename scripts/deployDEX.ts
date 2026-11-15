import { network } from "hardhat";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const { ethers } = await network.create({
  network: "ganache",
  chainType: "l1",
});
const [deployer] = await ethers.getSigners();
const deployerBalance = await ethers.provider.getBalance(deployer.address);
if (deployerBalance === 0n) {
  throw new Error(
    `Ganache deployer ${deployer.address} has no ETH. Set GANACHE_PRIVATE_KEY in .env to a funded Ganache account, or fund this account in Ganache.`,
  );
}
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
const oracleArtifact = JSON.parse(readFileSync(join(process.cwd(), "artifacts/contracts/SafeOracleReader.sol/SafeOracleReader.json"), "utf8"));
const mockArtifact = JSON.parse(readFileSync(join(process.cwd(), "artifacts/contracts/MockETHUSDOracle.sol/MockETHUSDOracle.json"), "utf8"));
mkdirSync(join(process.cwd(), "frontend", "src"), { recursive: true });
writeFileSync(
  join(process.cwd(), "frontend", "src", "dexConfig.js"),
  `import SafeOracleReader from "./contracts/SafeOracleReader.json";\nimport MockETHUSDOracle from "./contracts/MockETHUSDOracle.json";\nexport const DEX_CONFIG = ${JSON.stringify(addresses, null, 2)};\nexport const SAFE_ORACLE_ABI = SafeOracleReader.abi;\nexport const MOCK_ORACLE_ABI = MockETHUSDOracle.abi;\n`,
);
writeFileSync(
  join(process.cwd(), "frontend", "src", "contracts", "SafeOracleReader.json"),
  JSON.stringify({ abi: oracleArtifact.abi }, null, 2),
);
writeFileSync(
  join(process.cwd(), "frontend", "src", "contracts", "MockETHUSDOracle.json"),
  JSON.stringify({ abi: mockArtifact.abi }, null, 2),
);
console.log(JSON.stringify(addresses, null, 2));
