
import { network } from "hardhat";

async function main() {
  const { ethers } = await network.create({
    network: "ganache",
    chainType: "l1",
  });

  const [deployer] = await ethers.getSigners();

  console.log("Deploying with account:", deployer.address);

  // Deploy the test ERC-20 token
  const MockToken = await ethers.getContractFactory("MockToken");
  const mockToken = await MockToken.deploy();
  await mockToken.waitForDeployment();

  const tokenAddress = await mockToken.getAddress();
  console.log("MockToken deployed to:", tokenAddress);

  // Deploy the ERC-4626 vault using the mock token as its asset
  const InvestorVault = await ethers.getContractFactory("InvestorVault");
  const vault = await InvestorVault.deploy(tokenAddress);
  await vault.waitForDeployment();

  const vaultAddress = await vault.getAddress();
  console.log("InvestorVault deployed to:", vaultAddress);

  // Save the deployer's initial test-token balance
  const balance = await mockToken.balanceOf(deployer.address);
  console.log("Deployer sfUSD balance:", ethers.formatUnits(balance, 18));

  console.log("\nSave these addresses for the next step:");
  console.log("MOCK_TOKEN_ADDRESS =", tokenAddress);
  console.log("INVESTOR_VAULT_ADDRESS =", vaultAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
