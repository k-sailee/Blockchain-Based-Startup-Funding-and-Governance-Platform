import { expect } from "chai";
import { network } from "hardhat";

async function fixture() {
  const { ethers, networkHelpers } = await network.create();
  const [deployer, alice, bob, carol, dave, eve, frank, grace] = await ethers.getSigners();
  const token = await ethers.deployContract("GovernanceToken");
  const dao = await ethers.deployContract("DAOVoting", [await token.getAddress()]);
  for (const [signer, amount] of [[alice, 400], [bob, 250], [carol, 200], [dave, 100], [eve, 50]] as const) {
    await token.transfer(signer.address, ethers.parseEther(String(amount)));
    await token.connect(signer).delegate(signer.address);
  }
  return { ethers, networkHelpers, deployer, alice, bob, carol, dave, eve, frank, grace, token, dao };
}

async function closeVoting(networkHelpers: Awaited<ReturnType<typeof network.create>>["networkHelpers"]) {
  await networkHelpers.mine(6);
}

describe("Experiment 8 — DAO voting", function () {
  it("T1: succeeds when quorum and majority are reached", async function () {
    const { ethers, networkHelpers, alice, bob, carol, dao } = await fixture();
    await dao.connect(alice).propose("Accept experiment proposal");
    await dao.connect(alice).castVote(0, true);
    await dao.connect(bob).castVote(0, false);
    await dao.connect(carol).castVote(0, true);
    await closeVoting(networkHelpers);
    expect(await dao.getProposalVotes(0)).to.deep.equal([ethers.parseEther("250"), ethers.parseEther("600")]);
    expect(await dao.state(0)).to.equal(2n);
  });

  it("T2: defeats a proposal with a majority against", async function () {
    const { ethers, networkHelpers, alice, bob, carol, dao } = await fixture();
    await dao.connect(alice).propose("Reject experiment proposal");
    await dao.connect(alice).castVote(0, false);
    await dao.connect(bob).castVote(0, false);
    await dao.connect(carol).castVote(0, true);
    await closeVoting(networkHelpers);
    expect(await dao.getProposalVotes(0)).to.deep.equal([ethers.parseEther("650"), ethers.parseEther("200")]);
    expect(await dao.state(0)).to.equal(1n);
  });

  it("T3: succeeds with only 50 CDT turnout because minimum quorum is 40", async function () {
    const { networkHelpers, alice, eve, dao } = await fixture();
    await dao.connect(alice).propose("Low turnout proposal");
    await dao.connect(eve).castVote(0, true);
    await closeVoting(networkHelpers);
    expect(await dao.state(0)).to.equal(2n);
  });

  it("T4: defeats a proposal with no votes", async function () {
    const { networkHelpers, alice, dao } = await fixture();
    await dao.connect(alice).propose("No turnout proposal");
    await closeVoting(networkHelpers);
    expect(await dao.state(0)).to.equal(1n);
  });

  it("T5: rejects a second vote by the same address", async function () {
    const { alice, dao } = await fixture();
    await dao.connect(alice).propose("One vote only");
    await dao.connect(alice).castVote(0, true);
    await expect(dao.connect(alice).castVote(0, true)).to.be.revertedWithCustomError(dao, "AlreadyVoted");
  });

  it("T6: uses snapshot voting power after a post-snapshot transfer", async function () {
    const { ethers, alice, frank, token, dao } = await fixture();
    await dao.connect(alice).propose("Snapshot protects voting weight");
    await token.connect(alice).transfer(frank.address, ethers.parseEther("300"));
    await token.connect(frank).delegate(frank.address);
    await expect(dao.connect(frank).castVote(0, true)).to.be.revertedWithCustomError(dao, "NoVotingPower");
  });

  it("T7: rejects votes after the deadline", async function () {
    const { networkHelpers, alice, bob, dao } = await fixture();
    await dao.connect(alice).propose("Expired proposal");
    await closeVoting(networkHelpers);
    await expect(dao.connect(bob).castVote(0, true)).to.be.revertedWithCustomError(dao, "VotingClosed");
  });

  it("T8: rejects an account that did not delegate", async function () {
    const { ethers, alice, eve, grace, token, dao } = await fixture();
    await token.connect(eve).transfer(grace.address, ethers.parseEther("10"));
    await dao.connect(alice).propose("Delegation required");
    await expect(dao.connect(grace).castVote(0, true)).to.be.revertedWithCustomError(dao, "NoVotingPower");
  });

  it("T9: rejects proposal creation below the proposal threshold", async function () {
    const { grace, dao } = await fixture();
    await expect(dao.connect(grace).propose("No voting power")).to.be.revertedWithCustomError(dao, "ProposalThresholdNotMet");
  });
});
