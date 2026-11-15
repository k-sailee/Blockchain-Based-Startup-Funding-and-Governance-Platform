import { BrowserProvider, Contract, formatUnits, getAddress, isAddress, parseUnits } from "ethers";
import GovernanceToken from "../contracts/GovernanceToken.json";
import DAOVoting from "../contracts/DAOVoting.json";
import { DAO_CHAIN_ID, DAO_TOKEN_ADDRESS, DAO_VOTING_ADDRESS } from "../daoConfig";
import { getSelectedProvider } from "../walletManager";

const tokenAbi = GovernanceToken.abi || GovernanceToken;
const votingAbi = DAOVoting.abi || DAOVoting;

function addressOrThrow(value, name) {
  if (!isAddress(value || "")) throw new Error(`${name} is not configured with a valid address.`);
  return getAddress(value);
}

export async function getDAOContext(write = false) {
  const rawProvider = getSelectedProvider();
  if (!rawProvider) throw new Error("Connect your wallet first.");
  const provider = new BrowserProvider(rawProvider);
  const network = await provider.getNetwork();
  if (network.chainId !== BigInt(DAO_CHAIN_ID)) throw new Error(`Wrong network. Switch to chain ${DAO_CHAIN_ID}.`);
  const signer = write ? await provider.getSigner() : undefined;
  return { provider, signer };
}

export async function getGovernanceTokenContract(write = false) {
  const { provider, signer } = await getDAOContext(write);
  return new Contract(addressOrThrow(DAO_TOKEN_ADDRESS, "Governance token"), tokenAbi, signer || provider);
}

export async function getDAOVotingContract(write = false) {
  const { provider, signer } = await getDAOContext(write);
  return new Contract(addressOrThrow(DAO_VOTING_ADDRESS, "DAO voting contract"), votingAbi, signer || provider);
}

async function sendAndWait(txPromise) {
  try {
    const tx = await txPromise;
    return { hash: tx.hash, receipt: await tx.wait() };
  } catch (error) {
    if (error?.code === 4001 || error?.code === "ACTION_REJECTED") throw new Error("Transaction rejected in wallet.");
    if (error?.code === "INSUFFICIENT_FUNDS") throw new Error("Not enough native currency to pay gas.");
    throw new Error(error?.shortMessage || error?.reason || error?.message || "Transaction failed.");
  }
}

export async function getTokenBalance(account) {
  const token = await getGovernanceTokenContract();
  return formatUnits(await token.balanceOf(account), 18);
}
export async function getVotingPower(account) {
  const token = await getGovernanceTokenContract();
  return formatUnits(await token.getVotes(account), 18);
}
export async function getDelegate(account) {
  return (await (await getGovernanceTokenContract()).delegates(account));
}
export async function delegateVotes(address) {
  if (!isAddress(address)) throw new Error("Enter a valid delegate address.");
  const token = await getGovernanceTokenContract(true);
  return sendAndWait(token.delegate(getAddress(address)));
}
export async function createProposal(description) {
  if (!description.trim()) throw new Error("Proposal description is required.");
  return sendAndWait((await getDAOVotingContract(true)).propose(description.trim()));
}
export async function createFundingProposal(startupId, amountEth, title, description) {
  if (!Number.isSafeInteger(Number(startupId)) || Number(startupId) <= 0) throw new Error("Select a valid startup.");
  if (!title.trim() || !description.trim()) throw new Error("Title and description are required.");
  const amount = parseUnits(amountEth, 18);
  if (amount <= 0n) throw new Error("Funding amount must be greater than zero.");
  return sendAndWait((await getDAOVotingContract(true)).proposeFunding(BigInt(startupId), amount, title.trim(), description.trim()));
}
export async function castVote(proposalId, support) {
  return sendAndWait((await getDAOVotingContract(true)).castVote(BigInt(proposalId), Boolean(support)));
}
export async function getProposal(id) { return (await getDAOVotingContract()).getProposal(BigInt(id)); }
export async function getProposalVotes(id) {
  const [against, _for] = await (await getDAOVotingContract()).getProposalVotes(BigInt(id));
  return { against, for: _for };
}
export async function getProposalState(id) { return Number(await (await getDAOVotingContract()).state(BigInt(id))); }
export async function hasVoted(id, account) { return (await getDAOVotingContract()).hasVoted(BigInt(id), account); }
export async function getProposalCount() { return Number(await (await getDAOVotingContract()).getProposalCount()); }
export async function getVotingHistory(account) {
  const dao = await getDAOVotingContract();
  const logs = await dao.queryFilter(dao.filters.VoteCast(null, account), 0, "latest");
  return logs.map((log) => ({
    proposalId: Number(log.args.proposalId),
    support: log.args.support,
    weight: formatUnits(log.args.weight, 18),
    blockNumber: log.blockNumber,
  }));
}
export async function getHistoricalVotingPower(account, blockNumber) {
  const token = await getGovernanceTokenContract();
  return formatUnits(await token.getPastVotes(account, BigInt(blockNumber)), 18);
}
export async function getVotingPeriod() { return Number(await (await getDAOVotingContract()).getVotingPeriod()); }
export async function getQuorum() { return formatUnits(await (await getDAOVotingContract()).getQuorum(), 18); }
export function formatToken(value) { return formatUnits(value, 18); }
