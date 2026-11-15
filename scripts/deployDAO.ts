import "dotenv/config";
import { network } from "hardhat";
import fs from "node:fs";
import path from "node:path";

const cliNetworkIndex = process.argv.indexOf("--network");
const targetNetwork = process.env.HARDHAT_NETWORK || (cliNetworkIndex >= 0 ? process.argv[cliNetworkIndex + 1] : undefined) || "ganache";
const { ethers } = await network.create({ network: targetNetwork, chainType: "l1" });
const [deployer, ...availableSigners] = await ethers.getSigners();
if (!deployer) throw new Error("No deployer signer is available on the selected network.");
const chainId = Number((await ethers.provider.getNetwork()).chainId);
const accounts = (process.env.DAO_EXPERIMENT_ADDRESSES || "").split(",").map((x) => x.trim()).filter(Boolean);
let rpcAccounts: string[] = accounts.length >= 7 ? [] : await ethers.provider.send("eth_accounts", []);
if (accounts.length < 7 && rpcAccounts.filter((address) => address.toLowerCase() !== deployer.address.toLowerCase()).length < 7 && targetNetwork === "ganache") {
  const response = await fetch("http://127.0.0.1:7545", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_accounts", params: [] }),
  });
  if (!response.ok) throw new Error("Unable to query Ganache participant accounts.");
  const result = await response.json() as { result?: string[] };
  rpcAccounts = result.result || [];
}
const participants = accounts.length >= 7
  ? accounts.slice(0, 7)
  : availableSigners.length >= 7
    ? availableSigners.slice(0, 7).map((s) => s.address)
    : rpcAccounts.filter((address) => address.toLowerCase() !== deployer.address.toLowerCase()).slice(0, 7);
if (participants.length < 7 || participants.some((address) => !ethers.isAddress(address))) {
  throw new Error("Provide seven valid participant addresses in DAO_EXPERIMENT_ADDRESSES or use a local network with at least eight signers.");
}

console.log(`Network: ${targetNetwork} (${chainId})`);
console.log(`Deployer: ${deployer.address}`);
const token = await ethers.deployContract("GovernanceToken");
await token.waitForDeployment();
const tokenAddress = await token.getAddress();
const voterAddresses = participants;
const allocations = [400, 250, 200, 100, 50, 0, 0];
const signerByAddress = new Map(availableSigners.map((signer) => [signer.address.toLowerCase(), signer]));
const delegatedRecipients = new Set<string>();
for (let i = 0; i < 5; i++) {
  const recipient = voterAddresses[i];
  await (await token.transfer(recipient, ethers.parseEther(String(allocations[i])))).wait();
  let recipientSigner = signerByAddress.get(recipient.toLowerCase());
  if (recipientSigner) {
    await (await token.connect(recipientSigner).delegate(recipient)).wait();
    delegatedRecipients.add(recipient.toLowerCase());
  } else if (targetNetwork === "ganache") {
    const response = await fetch("http://127.0.0.1:7545", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_sendTransaction",
        params: [{ from: recipient, to: tokenAddress, gas: "0x493e0", data: token.interface.encodeFunctionData("delegate", [recipient]) }],
      }),
    });
    const result = await response.json() as { result?: string; error?: { message?: string } };
    if (!response.ok || result.error || !result.result) {
      throw new Error(`Ganache did not accept self-delegation for ${recipient}: ${result.error?.message || response.statusText}`);
    }
    const receipt = await ethers.provider.waitForTransaction(result.result);
    if (!receipt || receipt.status !== 1) throw new Error(`Self-delegation failed for ${recipient}.`);
    delegatedRecipients.add(recipient.toLowerCase());
  }
}
const dao = await ethers.deployContract("DAOVoting", [tokenAddress]);
await dao.waitForDeployment();
const daoAddress = await dao.getAddress();
if (await ethers.provider.getCode(tokenAddress) === "0x" || await ethers.provider.getCode(daoAddress) === "0x") {
  throw new Error("Deployment verification failed: contract bytecode is missing.");
}
const deploymentBlock = await ethers.provider.getBlockNumber();
const block = await ethers.provider.getBlock(deploymentBlock);
const manifest = {
  network: targetNetwork,
  chainId,
  governanceToken: tokenAddress,
  votingContract: daoAddress,
  deploymentBlock,
  deploymentTimestamp: new Date(Number(block?.timestamp || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
  compilerVersion: "0.8.28",
  academicParticipants: ["Alice", "Bob", "Carol", "Dave", "Eve", "Frank", "Grace"].map((name, index) => ({
    name,
    address: voterAddresses[index],
    allocation: allocations[index],
    selfDelegated: delegatedRecipients.has(voterAddresses[index].toLowerCase()),
  })),
};
const deploymentDir = path.resolve("deployments");
const frontendContractsDir = path.resolve("frontend/src/contracts");
fs.mkdirSync(deploymentDir, { recursive: true });
fs.mkdirSync(frontendContractsDir, { recursive: true });
fs.writeFileSync(path.join(deploymentDir, `dao-${targetNetwork}.json`), JSON.stringify(manifest, null, 2));
for (const name of ["GovernanceToken", "DAOVoting"]) {
  const artifact = await ethers.getContractFactory(name);
  fs.writeFileSync(path.join(frontendContractsDir, `${name}.json`), JSON.stringify({ abi: artifact.interface.formatJson() ? JSON.parse(artifact.interface.formatJson()) : [] }, null, 2));
}
console.log("GovernanceToken:", tokenAddress);
console.log("DAOVoting:", daoAddress);
console.log("Deployment block:", deploymentBlock);
console.log("Manifest:", path.join(deploymentDir, `dao-${targetNetwork}.json`));
