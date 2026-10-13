import { expect } from "chai";
import { network } from "hardhat";

describe("SimpleStaking", function () {
  async function deployStakingFixture() {
    const { ethers, networkHelpers } = await network.create();
    const [deployer, alice, bob] = await ethers.getSigners();

    const abcToken = await ethers.deployContract("MockERC20", [
      "ABC Protocol Token",
      "ABC",
    ]);
    await abcToken.waitForDeployment();

    const rwdToken = await ethers.deployContract("MockERC20", [
      "Reward Token",
      "RWD",
    ]);
    await rwdToken.waitForDeployment();

    const simpleStaking = await ethers.deployContract("SimpleStaking", [
      await abcToken.getAddress(),
      await rwdToken.getAddress(),
    ]);
    await simpleStaking.waitForDeployment();

    // Mint ABC to Alice (100 ABC) and Bob (50 ABC)
    const initialAliceABC = ethers.parseEther("100");
    await abcToken.mint(alice.address, initialAliceABC);
    await abcToken.mint(bob.address, ethers.parseEther("50"));

    // Fund staking contract with 10,000 RWD tokens
    const contractFundingRWD = ethers.parseEther("10000");
    await rwdToken.mint(await simpleStaking.getAddress(), contractFundingRWD);

    return {
      abcToken,
      rwdToken,
      simpleStaking,
      deployer,
      alice,
      bob,
      ethers,
      networkHelpers,
      initialAliceABC,
    };
  }

  // =========================================================
  // 1. TOKENS DEPLOY CORRECTLY
  // =========================================================
  it("should deploy mock tokens correctly with expected metadata and minting", async function () {
    const { abcToken, rwdToken, alice, ethers } = await deployStakingFixture();

    expect(await abcToken.name()).to.equal("ABC Protocol Token");
    expect(await abcToken.symbol()).to.equal("ABC");
    expect(await abcToken.decimals()).to.equal(18);

    expect(await rwdToken.name()).to.equal("Reward Token");
    expect(await rwdToken.symbol()).to.equal("RWD");
    expect(await rwdToken.decimals()).to.equal(18);

    expect(await abcToken.balanceOf(alice.address)).to.equal(ethers.parseEther("100"));
  });

  // =========================================================
  // 2. STAKING CONTRACT DEPLOYS WITH VALID TOKEN ADDRESSES
  // =========================================================
  it("should deploy staking contract with valid token addresses and reward rate", async function () {
    const { abcToken, rwdToken, simpleStaking, ethers } = await deployStakingFixture();

    expect(await simpleStaking.stakingToken()).to.equal(await abcToken.getAddress());
    expect(await simpleStaking.rewardToken()).to.equal(await rwdToken.getAddress());
    expect(await simpleStaking.rewardRate()).to.equal(10n ** 15n); // 0.001 * 1e18

    // Reject deployment with zero address
    const SimpleStakingFactory = await ethers.getContractFactory("SimpleStaking");
    await expect(
      SimpleStakingFactory.deploy(ethers.ZeroAddress, await rwdToken.getAddress())
    ).to.be.revertedWith("Invalid staking token address");
    await expect(
      SimpleStakingFactory.deploy(await abcToken.getAddress(), ethers.ZeroAddress)
    ).to.be.revertedWith("Invalid reward token address");
  });

  // =========================================================
  // 3. ZERO-VALUE STAKING IS REJECTED
  // =========================================================
  it("should reject zero-value staking", async function () {
    const { simpleStaking, alice } = await deployStakingFixture();

    await expect(simpleStaking.connect(alice).stake(0)).to.be.revertedWith(
      "Cannot stake 0"
    );
  });

  // =========================================================
  // 4 & 5. APPROVAL, STAKING, AND RECORDED STAKED BALANCE
  // =========================================================
  it("should allow approval and record staked balance correctly", async function () {
    const { abcToken, simpleStaking, alice, ethers } = await deployStakingFixture();
    const stakeAmount = ethers.parseEther("100");

    await abcToken.connect(alice).approve(await simpleStaking.getAddress(), stakeAmount);

    await expect(simpleStaking.connect(alice).stake(stakeAmount))
      .to.emit(simpleStaking, "Staked")
      .withArgs(alice.address, stakeAmount);

    expect(await simpleStaking.stakedBalance(alice.address)).to.equal(stakeAmount);
    expect(await abcToken.balanceOf(alice.address)).to.equal(0n);
    expect(await abcToken.balanceOf(await simpleStaking.getAddress())).to.equal(stakeAmount);
  });

  // =========================================================
  // 6. REWARDS ACCRUE OVER TIME (60s -> ~6 RWD for 100 ABC)
  // =========================================================
  it("should accrue rewards accurately over time (100 ABC staked for 60s accrues 6 RWD)", async function () {
    const { abcToken, simpleStaking, alice, networkHelpers, ethers } =
      await deployStakingFixture();
    const stakeAmount = ethers.parseEther("100");

    await abcToken.connect(alice).approve(await simpleStaking.getAddress(), stakeAmount);
    await simpleStaking.connect(alice).stake(stakeAmount);

    // Fast-forward 60 seconds
    await networkHelpers.time.increase(60);

    const earned = await simpleStaking.earned(alice.address);
    // 100 ABC * 0.001 * 60 = 6 RWD
    const expected = ethers.parseEther("6");
    expect(earned).to.be.closeTo(expected, ethers.parseEther("0.1"));
  });

  // =========================================================
  // 7. REWARD CLAIMING TRANSFERS RWD CORRECTLY
  // =========================================================
  it("should claim accumulated rewards and transfer RWD tokens", async function () {
    const { abcToken, rwdToken, simpleStaking, alice, bob, networkHelpers, ethers } =
      await deployStakingFixture();
    const stakeAmount = ethers.parseEther("100");

    await abcToken.connect(alice).approve(await simpleStaking.getAddress(), stakeAmount);
    await simpleStaking.connect(alice).stake(stakeAmount);

    await networkHelpers.time.increase(60);

    const tx = await simpleStaking.connect(alice).claimReward();
    await expect(tx).to.emit(simpleStaking, "RewardClaimed");

    const rwdBalance = await rwdToken.balanceOf(alice.address);
    expect(rwdBalance).to.be.closeTo(ethers.parseEther("6.1"), ethers.parseEther("0.2"));
    expect(await simpleStaking.pendingReward(alice.address)).to.equal(0n);

    // User with zero stake / zero pending rewards should revert
    await expect(simpleStaking.connect(bob).claimReward()).to.be.revertedWith(
      "No rewards to claim"
    );
  });

  // =========================================================
  // 8. PARTIAL UNSTAKING PRESERVES REMAINING STAKE AND ACCRUED REWARDS
  // =========================================================
  it("should allow partial unstaking, return tokens, and preserve remaining stake and rewards", async function () {
    const { abcToken, simpleStaking, alice, networkHelpers, ethers } =
      await deployStakingFixture();
    const stakeAmount = ethers.parseEther("100");
    const unstakeAmount = ethers.parseEther("40");

    await abcToken.connect(alice).approve(await simpleStaking.getAddress(), stakeAmount);
    await simpleStaking.connect(alice).stake(stakeAmount);

    // Pass 60 seconds
    await networkHelpers.time.increase(60);

    // Unstake 40 ABC
    await expect(simpleStaking.connect(alice).unstake(unstakeAmount))
      .to.emit(simpleStaking, "Unstaked")
      .withArgs(alice.address, unstakeAmount);

    expect(await abcToken.balanceOf(alice.address)).to.equal(unstakeAmount);
    expect(await simpleStaking.stakedBalance(alice.address)).to.equal(ethers.parseEther("60"));

    // Previously accrued reward is preserved in pendingReward (around 6 RWD)
    const earnedAfter = await simpleStaking.earned(alice.address);
    expect(earnedAfter).to.be.gte(ethers.parseEther("6"));
  });

  // =========================================================
  // 9. OVER-WITHDRAWAL AND ZERO WITHDRAWAL ARE REJECTED
  // =========================================================
  it("should reject over-withdrawal and zero withdrawal", async function () {
    const { abcToken, simpleStaking, alice, ethers } = await deployStakingFixture();
    const stakeAmount = ethers.parseEther("50");

    await abcToken.connect(alice).approve(await simpleStaking.getAddress(), stakeAmount);
    await simpleStaking.connect(alice).stake(stakeAmount);

    await expect(simpleStaking.connect(alice).unstake(0)).to.be.revertedWith(
      "Cannot unstake 0"
    );

    await expect(
      simpleStaking.connect(alice).unstake(ethers.parseEther("51"))
    ).to.be.revertedWith("Withdrawal exceeds staked balance");
  });

  // =========================================================
  // 10. EXIT RETURNS ALL REMAINING STAKE AND CLAIMS ALL REWARDS
  // =========================================================
  it("should exit by returning all remaining staked tokens and claiming all rewards", async function () {
    const { abcToken, rwdToken, simpleStaking, alice, networkHelpers, ethers } =
      await deployStakingFixture();
    const stakeAmount = ethers.parseEther("100");

    await abcToken.connect(alice).approve(await simpleStaking.getAddress(), stakeAmount);
    await simpleStaking.connect(alice).stake(stakeAmount);

    await networkHelpers.time.increase(60);

    // Unstake partial 40 ABC first
    await simpleStaking.connect(alice).unstake(ethers.parseEther("40"));

    // Another 10 seconds
    await networkHelpers.time.increase(10);

    // Alice calls exit()
    const tx = await simpleStaking.connect(alice).exit();
    await expect(tx).to.emit(simpleStaking, "Unstaked").withArgs(alice.address, ethers.parseEther("60"));
    await expect(tx).to.emit(simpleStaking, "RewardClaimed");

    // All 100 ABC returned
    expect(await abcToken.balanceOf(alice.address)).to.equal(ethers.parseEther("100"));
    expect(await simpleStaking.stakedBalance(alice.address)).to.equal(0n);
    expect(await simpleStaking.pendingReward(alice.address)).to.equal(0n);

    // RWD claimed: ~6 RWD for 60s at 100 ABC + ~0.6 RWD for 10s at 60 ABC = ~6.6 RWD
    const rwdBal = await rwdToken.balanceOf(alice.address);
    expect(rwdBal).to.be.closeTo(ethers.parseEther("6.7"), ethers.parseEther("0.2"));

    // Exit when empty reverts
    await expect(simpleStaking.connect(alice).exit()).to.be.revertedWith(
      "No staked tokens or rewards to exit"
    );
  });

  // =========================================================
  // 11. INSUFFICIENT REWARD FUNDING IS HANDLED SAFELY
  // =========================================================
  it("should handle insufficient reward funding safely without corrupting state", async function () {
    const { ethers, networkHelpers } = await network.create();
    const [, alice] = await ethers.getSigners();

    const abc = await ethers.deployContract("MockERC20", ["ABC", "ABC"]);
    const rwd = await ethers.deployContract("MockERC20", ["RWD", "RWD"]);
    const staking = await ethers.deployContract("SimpleStaking", [
      await abc.getAddress(),
      await rwd.getAddress(),
    ]);

    // Give Alice 100 ABC
    await abc.mint(alice.address, ethers.parseEther("100"));
    // Fund contract with only 1 RWD
    await rwd.mint(await staking.getAddress(), ethers.parseEther("1"));

    await abc.connect(alice).approve(await staking.getAddress(), ethers.parseEther("100"));
    await staking.connect(alice).stake(ethers.parseEther("100"));

    // Fast-forward 1000 seconds (Alice earns 100 RWD, but contract only has 1 RWD)
    await networkHelpers.time.increase(1000);

    await expect(staking.connect(alice).claimReward()).to.be.revertedWith(
      "Insufficient reward token balance in contract"
    );

    // Alice's staked balance is unaffected and can be unstaked safely
    await staking.connect(alice).unstake(ethers.parseEther("100"));
    expect(await abc.balanceOf(alice.address)).to.equal(ethers.parseEther("100"));
  });
});
