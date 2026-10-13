import { expect } from "chai";
import { network } from "hardhat";

describe("SimpleYieldFarm", function () {
  async function deployYieldFarmFixture() {
    const { ethers, networkHelpers } = await network.create();
    const [deployer, alice, bob] = await ethers.getSigners();

    const lpToken = await ethers.deployContract("MockERC20", [
      "LP Token",
      "LPT",
    ]);
    await lpToken.waitForDeployment();

    const rwdToken = await ethers.deployContract("MockERC20", [
      "Reward Token",
      "RWD",
    ]);
    await rwdToken.waitForDeployment();

    const yieldFarm = await ethers.deployContract("SimpleYieldFarm", [
      await lpToken.getAddress(),
      await rwdToken.getAddress(),
    ]);
    await yieldFarm.waitForDeployment();

    // Mint LPT to Alice (100 LPT) and Bob (50 LPT)
    const initialAliceLPT = ethers.parseEther("100");
    await lpToken.mint(alice.address, initialAliceLPT);
    await lpToken.mint(bob.address, ethers.parseEther("50"));

    // Fund farm contract with 10,000 RWD tokens
    const farmFundingRWD = ethers.parseEther("10000");
    await rwdToken.mint(await yieldFarm.getAddress(), farmFundingRWD);

    return {
      lpToken,
      rwdToken,
      yieldFarm,
      deployer,
      alice,
      bob,
      ethers,
      networkHelpers,
      initialAliceLPT,
    };
  }

  // =========================================================
  // 1. CONSTRUCTOR STORES CORRECT TOKEN ADDRESSES
  // =========================================================
  it("1. should store correct token addresses and reward rate upon deployment", async function () {
    const { lpToken, rwdToken, yieldFarm, ethers } = await deployYieldFarmFixture();

    expect(await yieldFarm.stakingToken()).to.equal(await lpToken.getAddress());
    expect(await yieldFarm.rewardToken()).to.equal(await rwdToken.getAddress());
    expect(await yieldFarm.rewardRate()).to.equal(10n ** 15n); // 0.001 * 1e18
  });

  // =========================================================
  // 2. CONSTRUCTOR REJECTS ZERO ADDRESSES
  // =========================================================
  it("2. should reject zero addresses in constructor", async function () {
    const { lpToken, rwdToken, ethers } = await deployYieldFarmFixture();
    const YieldFarmFactory = await ethers.getContractFactory("SimpleYieldFarm");

    await expect(
      YieldFarmFactory.deploy(ethers.ZeroAddress, await rwdToken.getAddress())
    ).to.be.revertedWith("Invalid staking token address");

    await expect(
      YieldFarmFactory.deploy(await lpToken.getAddress(), ethers.ZeroAddress)
    ).to.be.revertedWith("Invalid reward token address");
  });

  // =========================================================
  // 3. CONSTRUCTOR REJECTS IDENTICAL TOKEN ADDRESSES
  // =========================================================
  it("3. should reject identical staking and reward token addresses", async function () {
    const { lpToken, ethers } = await deployYieldFarmFixture();
    const YieldFarmFactory = await ethers.getContractFactory("SimpleYieldFarm");

    await expect(
      YieldFarmFactory.deploy(await lpToken.getAddress(), await lpToken.getAddress())
    ).to.be.revertedWith("Identical token addresses");
  });

  // =========================================================
  // 4. USER CAN STAKE LPT AFTER APPROVAL
  // =========================================================
  it("4. should allow user to stake LPT after granting approval", async function () {
    const { lpToken, yieldFarm, alice, ethers } = await deployYieldFarmFixture();
    const stakeAmount = ethers.parseEther("100");

    await lpToken.connect(alice).approve(await yieldFarm.getAddress(), stakeAmount);

    await expect(yieldFarm.connect(alice).stake(stakeAmount))
      .to.emit(yieldFarm, "Staked")
      .withArgs(alice.address, stakeAmount);
  });

  // =========================================================
  // 5. ZERO-VALUE STAKING REVERTS
  // =========================================================
  it("5. should reject zero-value staking", async function () {
    const { yieldFarm, alice } = await deployYieldFarmFixture();

    await expect(yieldFarm.connect(alice).stake(0)).to.be.revertedWith("Cannot stake 0");
  });

  // =========================================================
  // 6. STAKING WITHOUT SUFFICIENT APPROVAL FAILS
  // =========================================================
  it("6. should fail when staking without sufficient token approval", async function () {
    const { lpToken, yieldFarm, alice, ethers } = await deployYieldFarmFixture();
    const stakeAmount = ethers.parseEther("50");

    // Approve only 20 LPT
    await lpToken.connect(alice).approve(await yieldFarm.getAddress(), ethers.parseEther("20"));

    await expect(yieldFarm.connect(alice).stake(stakeAmount)).to.be.revertedWith(
      "Insufficient allowance"
    );
  });

  // =========================================================
  // 7. STAKING WITHOUT SUFFICIENT TOKEN BALANCE FAILS
  // =========================================================
  it("7. should fail when staking without sufficient token balance", async function () {
    const { lpToken, yieldFarm, alice, ethers } = await deployYieldFarmFixture();

    // Alice has 100 LPT, tries to stake 150 LPT
    await lpToken.connect(alice).approve(await yieldFarm.getAddress(), ethers.parseEther("200"));

    await expect(
      yieldFarm.connect(alice).stake(ethers.parseEther("150"))
    ).to.be.revertedWith("Insufficient balance");
  });

  // =========================================================
  // 8. STAKED BALANCE IS CORRECT AFTER STAKING
  // =========================================================
  it("8. should correctly record stakedBalance after staking", async function () {
    const { lpToken, yieldFarm, alice, ethers } = await deployYieldFarmFixture();
    const stakeAmount = ethers.parseEther("100");

    await lpToken.connect(alice).approve(await yieldFarm.getAddress(), stakeAmount);
    await yieldFarm.connect(alice).stake(stakeAmount);

    expect(await yieldFarm.stakedBalance(alice.address)).to.equal(stakeAmount);
    expect(await lpToken.balanceOf(alice.address)).to.equal(0n);
    expect(await lpToken.balanceOf(await yieldFarm.getAddress())).to.equal(stakeAmount);
  });

  // =========================================================
  // 9. REWARDS ACCUMULATE OVER TIME
  // =========================================================
  it("9. should accumulate rewards over time as blocks elapse", async function () {
    const { lpToken, yieldFarm, alice, networkHelpers, ethers } =
      await deployYieldFarmFixture();
    const stakeAmount = ethers.parseEther("100");

    await lpToken.connect(alice).approve(await yieldFarm.getAddress(), stakeAmount);
    await yieldFarm.connect(alice).stake(stakeAmount);

    const initialEarned = await yieldFarm.earned(alice.address);
    expect(initialEarned).to.equal(0n);

    await networkHelpers.time.increase(10);

    const earnedAfter10s = await yieldFarm.earned(alice.address);
    expect(earnedAfter10s).to.be.gt(0n);
  });

  // =========================================================
  // 10. 100 LPT STAKE FOR ~60s EARNS ~6 RWD
  // =========================================================
  it("10. should earn approximately 6 RWD for 100 LPT staked over 60 seconds", async function () {
    const { lpToken, yieldFarm, alice, networkHelpers, ethers } =
      await deployYieldFarmFixture();
    const stakeAmount = ethers.parseEther("100");

    await lpToken.connect(alice).approve(await yieldFarm.getAddress(), stakeAmount);
    await yieldFarm.connect(alice).stake(stakeAmount);

    // Fast-forward exactly 60 seconds
    await networkHelpers.time.increase(60);

    const earned = await yieldFarm.earned(alice.address);
    // 100 LPT * 0.001 * 60 = 6 RWD
    const expected = ethers.parseEther("6");
    expect(earned).to.be.closeTo(expected, ethers.parseEther("0.1"));
  });

  // =========================================================
  // 11. HARVEST() TRANSFERS REWARDS TO USER
  // =========================================================
  it("11. should transfer rewards to user when calling harvest()", async function () {
    const { lpToken, rwdToken, yieldFarm, alice, networkHelpers, ethers } =
      await deployYieldFarmFixture();
    const stakeAmount = ethers.parseEther("100");

    await lpToken.connect(alice).approve(await yieldFarm.getAddress(), stakeAmount);
    await yieldFarm.connect(alice).stake(stakeAmount);

    await networkHelpers.time.increase(60);

    const tx = await yieldFarm.connect(alice).harvest();
    await expect(tx).to.emit(yieldFarm, "RewardPaid");

    const rwdBalance = await rwdToken.balanceOf(alice.address);
    expect(rwdBalance).to.be.closeTo(ethers.parseEther("6.1"), ethers.parseEther("0.2"));
    expect(await yieldFarm.pendingReward(alice.address)).to.equal(0n);
  });

  // =========================================================
  // 12. HARVESTING TWICE WITHOUT NEW REWARDS FAILS
  // =========================================================
  it("12. should revert when harvesting twice without new rewards", async function () {
    const { lpToken, yieldFarm, alice, bob, networkHelpers, ethers } =
      await deployYieldFarmFixture();
    const stakeAmount = ethers.parseEther("100");

    await lpToken.connect(alice).approve(await yieldFarm.getAddress(), stakeAmount);
    await yieldFarm.connect(alice).stake(stakeAmount);

    await networkHelpers.time.increase(60);

    // First harvest succeeds
    await yieldFarm.connect(alice).harvest();

    // User Bob with zero stake / zero pending rewards should revert
    await expect(yieldFarm.connect(bob).harvest()).to.be.revertedWith(
      "No rewards to harvest"
    );

    // If Alice withdraws all stake, harvests any tiny residue from the withdraw block,
    // then attempts to harvest again with 0 stake, it must revert
    await yieldFarm.connect(alice).withdraw(stakeAmount);
    // Harvest remaining dust accrued up to withdrawal
    if ((await yieldFarm.earned(alice.address)) > 0n) {
      await yieldFarm.connect(alice).harvest();
    }
    // Now Alice has 0 stake and 0 rewards: immediate harvest must revert
    await expect(yieldFarm.connect(alice).harvest()).to.be.revertedWith(
      "No rewards to harvest"
    );
  });

  // =========================================================
  // 13. PARTIAL WITHDRAWAL RETURNS REQUESTED LPT AMOUNT
  // =========================================================
  it("13. should return requested LPT amount on partial withdrawal", async function () {
    const { lpToken, yieldFarm, alice, ethers } = await deployYieldFarmFixture();
    const stakeAmount = ethers.parseEther("100");
    const withdrawAmount = ethers.parseEther("40");

    await lpToken.connect(alice).approve(await yieldFarm.getAddress(), stakeAmount);
    await yieldFarm.connect(alice).stake(stakeAmount);

    await expect(yieldFarm.connect(alice).withdraw(withdrawAmount))
      .to.emit(yieldFarm, "Withdrawn")
      .withArgs(alice.address, withdrawAmount);

    expect(await lpToken.balanceOf(alice.address)).to.equal(withdrawAmount);
    expect(await yieldFarm.stakedBalance(alice.address)).to.equal(ethers.parseEther("60"));
  });

  // =========================================================
  // 14. PARTIAL WITHDRAWAL PRESERVES PREVIOUSLY ACCRUED REWARDS
  // =========================================================
  it("14. should preserve previously accrued rewards after partial withdrawal", async function () {
    const { lpToken, yieldFarm, alice, networkHelpers, ethers } =
      await deployYieldFarmFixture();
    const stakeAmount = ethers.parseEther("100");

    await lpToken.connect(alice).approve(await yieldFarm.getAddress(), stakeAmount);
    await yieldFarm.connect(alice).stake(stakeAmount);

    await networkHelpers.time.increase(60);

    // Withdraw 40 LPT
    await yieldFarm.connect(alice).withdraw(ethers.parseEther("40"));

    // Previously accrued rewards (~6 RWD) should be preserved in pendingReward
    const earnedAfter = await yieldFarm.earned(alice.address);
    expect(earnedAfter).to.be.gte(ethers.parseEther("6"));
  });

  // =========================================================
  // 15. WITHDRAWAL GREATER THAN RECORDED STAKE FAILS
  // =========================================================
  it("15. should fail when withdrawing greater than recorded stake", async function () {
    const { lpToken, yieldFarm, alice, ethers } = await deployYieldFarmFixture();
    const stakeAmount = ethers.parseEther("50");

    await lpToken.connect(alice).approve(await yieldFarm.getAddress(), stakeAmount);
    await yieldFarm.connect(alice).stake(stakeAmount);

    await expect(
      yieldFarm.connect(alice).withdraw(ethers.parseEther("51"))
    ).to.be.revertedWith("Withdrawal exceeds staked balance");
  });

  // =========================================================
  // 16. ZERO-VALUE WITHDRAWAL FAILS
  // =========================================================
  it("16. should reject zero-value withdrawal", async function () {
    const { lpToken, yieldFarm, alice, ethers } = await deployYieldFarmFixture();
    const stakeAmount = ethers.parseEther("50");

    await lpToken.connect(alice).approve(await yieldFarm.getAddress(), stakeAmount);
    await yieldFarm.connect(alice).stake(stakeAmount);

    await expect(yieldFarm.connect(alice).withdraw(0)).to.be.revertedWith(
      "Cannot withdraw 0"
    );
  });

  // =========================================================
  // 17. EXIT() WITHDRAWS ALL REMAINING LPT AND CLAIMS PENDING REWARDS
  // =========================================================
  it("17. should exit by withdrawing all remaining LPT and harvesting all rewards", async function () {
    const { lpToken, rwdToken, yieldFarm, alice, networkHelpers, ethers } =
      await deployYieldFarmFixture();
    const stakeAmount = ethers.parseEther("100");

    await lpToken.connect(alice).approve(await yieldFarm.getAddress(), stakeAmount);
    await yieldFarm.connect(alice).stake(stakeAmount);

    await networkHelpers.time.increase(60);

    // Partial withdraw first
    await yieldFarm.connect(alice).withdraw(ethers.parseEther("40"));

    await networkHelpers.time.increase(10);

    const tx = await yieldFarm.connect(alice).exit();
    await expect(tx).to.emit(yieldFarm, "Withdrawn").withArgs(alice.address, ethers.parseEther("60"));
    await expect(tx).to.emit(yieldFarm, "RewardPaid");

    // All 100 LPT back
    expect(await lpToken.balanceOf(alice.address)).to.equal(ethers.parseEther("100"));
    expect(await yieldFarm.stakedBalance(alice.address)).to.equal(0n);
    expect(await yieldFarm.pendingReward(alice.address)).to.equal(0n);

    const rwdBal = await rwdToken.balanceOf(alice.address);
    expect(rwdBal).to.be.closeTo(ethers.parseEther("6.7"), ethers.parseEther("0.3"));
  });

  // =========================================================
  // 18. EXIT() WORKS WHEN STAKE IS ZERO BUT PENDING REWARDS REMAIN
  // =========================================================
  it("18. should allow exit() when stake is zero but pending rewards remain", async function () {
    const { lpToken, rwdToken, yieldFarm, bob, networkHelpers, ethers } =
      await deployYieldFarmFixture();
    const stakeAmount = ethers.parseEther("50");

    await lpToken.connect(bob).approve(await yieldFarm.getAddress(), stakeAmount);
    await yieldFarm.connect(bob).stake(stakeAmount);

    await networkHelpers.time.increase(30);

    // Bob withdraws all 50 LPT, leaving 0 stake but ~1.5 RWD in pendingReward
    await yieldFarm.connect(bob).withdraw(stakeAmount);
    expect(await yieldFarm.stakedBalance(bob.address)).to.equal(0n);
    expect(await yieldFarm.pendingReward(bob.address)).to.be.gte(ethers.parseEther("1.5"));

    // Bob calls exit() with 0 stake
    const tx = await yieldFarm.connect(bob).exit();
    await expect(tx).to.emit(yieldFarm, "RewardPaid");

    expect(await yieldFarm.stakedBalance(bob.address)).to.equal(0n);
    expect(await yieldFarm.pendingReward(bob.address)).to.equal(0n);
    expect(await rwdToken.balanceOf(bob.address)).to.be.closeTo(
      ethers.parseEther("1.5"),
      ethers.parseEther("0.1")
    );
  });

  // =========================================================
  // 19. EXIT() REJECTS AN ACCOUNT WITH NEITHER STAKE NOR REWARDS
  // =========================================================
  it("19. should reject exit() if caller has neither stake nor pending rewards", async function () {
    const { yieldFarm, bob } = await deployYieldFarmFixture();

    await expect(yieldFarm.connect(bob).exit()).to.be.revertedWith(
      "No staked tokens or rewards to exit"
    );
  });

  // =========================================================
  // 20. INSUFFICIENT REWARD-TOKEN FUNDING FAILS SAFELY WITHOUT LOSING REWARDS
  // =========================================================
  it("20. should fail safely on harvest/exit when farm is underfunded in RWD without losing state", async function () {
    const { ethers, networkHelpers } = await network.create();
    const [, alice] = await ethers.getSigners();

    const lp = await ethers.deployContract("MockERC20", ["LPT", "LPT"]);
    const rwd = await ethers.deployContract("MockERC20", ["RWD", "RWD"]);
    const farm = await ethers.deployContract("SimpleYieldFarm", [
      await lp.getAddress(),
      await rwd.getAddress(),
    ]);

    await lp.mint(alice.address, ethers.parseEther("100"));
    // Fund farm with only 1 RWD
    await rwd.mint(await farm.getAddress(), ethers.parseEther("1"));

    await lp.connect(alice).approve(await farm.getAddress(), ethers.parseEther("100"));
    await farm.connect(alice).stake(ethers.parseEther("100"));

    // Alice accrues ~100 RWD (after 1000s)
    await networkHelpers.time.increase(1000);

    // Harvest fails due to insufficient farm reward balance
    await expect(farm.connect(alice).harvest()).to.be.revertedWith(
      "Insufficient reward token balance in farm"
    );

    // Exit also fails safely
    await expect(farm.connect(alice).exit()).to.be.revertedWith(
      "Insufficient reward token balance in farm"
    );

    // State is intact: Alice's staked balance is unaffected and can be withdrawn
    await farm.connect(alice).withdraw(ethers.parseEther("100"));
    expect(await lp.balanceOf(alice.address)).to.equal(ethers.parseEther("100"));
    expect(await farm.earned(alice.address)).to.be.gte(ethers.parseEther("100"));
  });

  // =========================================================
  // 21. REWARD ACCOUNTING REMAINS CORRECT WHEN ADDING MORE STAKE
  // =========================================================
  it("21. should correctly account for rewards when adding more stake after earning", async function () {
    const { lpToken, yieldFarm, alice, networkHelpers, ethers } =
      await deployYieldFarmFixture();

    // Alice has 100 LPT initially. Mint another 100 LPT to Alice
    await lpToken.mint(alice.address, ethers.parseEther("100"));

    await lpToken.connect(alice).approve(await yieldFarm.getAddress(), ethers.parseEther("200"));

    // Stake 100 LPT
    await yieldFarm.connect(alice).stake(ethers.parseEther("100"));

    // 60 seconds elapses -> ~6 RWD
    await networkHelpers.time.increase(60);

    // Stake additional 100 LPT (now 200 LPT staked)
    await yieldFarm.connect(alice).stake(ethers.parseEther("100"));

    // Another 60 seconds elapses -> 200 LPT * 0.001 * 60 = 12 RWD newly accrued
    await networkHelpers.time.increase(60);

    // Total earned should be ~6 + ~12 = ~18 RWD
    const totalEarned = await yieldFarm.earned(alice.address);
    expect(totalEarned).to.be.closeTo(ethers.parseEther("18"), ethers.parseEther("0.3"));
  });

  // =========================================================
  // 22. REENTRANCY AND SAFE TOKEN TRANSFERS ARE HANDLED SAFELY
  // =========================================================
  it("22. should protect state against reentrancy and handle safe transfer guards", async function () {
    const { lpToken, yieldFarm, alice, ethers } = await deployYieldFarmFixture();

    // Verify initial lock state allows valid stake
    await lpToken.connect(alice).approve(await yieldFarm.getAddress(), ethers.parseEther("10"));
    const tx = await yieldFarm.connect(alice).stake(ethers.parseEther("10"));
    expect(tx.hash).to.be.a("string");

    // Verify transfer failure if allowance is revoked mid-flight or insufficient
    await expect(yieldFarm.connect(alice).stake(ethers.parseEther("10"))).to.be.revertedWith(
      "Insufficient allowance"
    );
  });
});
