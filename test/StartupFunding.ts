import { expect } from "chai";
import { network } from "hardhat";

describe("StartupFunding", function () {

  async function deployContract() {

    const { ethers } = await network.connect();

    const [founder, investor1, investor2] =
      await ethers.getSigners();

    const startupFunding =
      await ethers.deployContract("StartupFunding");

    await startupFunding.waitForDeployment();

    return {
      startupFunding,
      founder,
      investor1,
      investor2,
      ethers
    };
  }


  // =========================================================
  // TEST 1: CREATE STARTUP
  // =========================================================

  it("should allow a founder to create a startup", async function () {

    const {
      startupFunding,
      founder
    } = await deployContract();

    const fundingGoal =
      10n * 10n ** 18n; // 10 ETH

    await startupFunding.createStartup(
      "GreenTech",
      "A startup building sustainable technology",
      fundingGoal
    );

    const startup =
      await startupFunding.getStartup(1);

    expect(startup[0]).to.equal(1n);

    expect(startup[1]).to.equal(founder.address);

    expect(startup[2]).to.equal("GreenTech");

    expect(startup[3]).to.equal(
      "A startup building sustainable technology"
    );

    expect(startup[4]).to.equal(fundingGoal);

    expect(startup[5]).to.equal(0n);

    expect(startup[6]).to.equal(true);
  });


  // =========================================================
  // TEST 2: INVESTOR CAN INVEST
  // =========================================================

  it("should allow an investor to invest in a startup", async function () {

    const {
      startupFunding,
      investor1,
      ethers
    } = await deployContract();

    const fundingGoal =
      ethers.parseEther("10");

    await startupFunding.createStartup(
      "GreenTech",
      "A sustainable technology startup",
      fundingGoal
    );

    const investment =
      ethers.parseEther("2");

    await startupFunding
      .connect(investor1)
      .invest(1, {
        value: investment
      });

    const startup =
      await startupFunding.getStartup(1);

    expect(startup[5]).to.equal(investment);
  });


  // =========================================================
  // TEST 3: INVESTOR ADDRESS AND AMOUNT ARE STORED
  // =========================================================

  it("should record who invested and how much they invested", async function () {

    const {
      startupFunding,
      investor1,
      ethers
    } = await deployContract();

    const fundingGoal =
      ethers.parseEther("10");

    await startupFunding.createStartup(
      "HealthAI",
      "AI based healthcare startup",
      fundingGoal
    );

    const investment =
      ethers.parseEther("3");

    await startupFunding
      .connect(investor1)
      .invest(1, {
        value: investment
      });

    const count =
      await startupFunding.getInvestmentCount(1);

    expect(count).to.equal(1n);

    const record =
      await startupFunding.getInvestment(1, 0);

    expect(record[0]).to.equal(investor1.address);

    expect(record[1]).to.equal(investment);
  });


  // =========================================================
  // TEST 4: MULTIPLE INVESTORS
  // =========================================================

  it("should record multiple investors separately", async function () {

    const {
      startupFunding,
      investor1,
      investor2,
      ethers
    } = await deployContract();

    const fundingGoal =
      ethers.parseEther("10");

    await startupFunding.createStartup(
      "EduTech",
      "Technology platform for education",
      fundingGoal
    );

    const investment1 =
      ethers.parseEther("2");

    const investment2 =
      ethers.parseEther("3");

    await startupFunding
      .connect(investor1)
      .invest(1, {
        value: investment1
      });

    await startupFunding
      .connect(investor2)
      .invest(1, {
        value: investment2
      });

    const count =
      await startupFunding.getInvestmentCount(1);

    expect(count).to.equal(2n);

    const record1 =
      await startupFunding.getInvestment(1, 0);

    const record2 =
      await startupFunding.getInvestment(1, 1);

    expect(record1[0]).to.equal(investor1.address);

    expect(record1[1]).to.equal(investment1);

    expect(record2[0]).to.equal(investor2.address);

    expect(record2[1]).to.equal(investment2);

    const startup =
      await startupFunding.getStartup(1);

    expect(startup[5]).to.equal(
      ethers.parseEther("5")
    );
  });


  // =========================================================
  // TEST 5: FUNDING CLOSES WHEN GOAL IS REACHED
  // =========================================================

  it("should close funding when the funding goal is reached", async function () {

    const {
      startupFunding,
      investor1,
      ethers
    } = await deployContract();

    const fundingGoal =
      ethers.parseEther("5");

    await startupFunding.createStartup(
      "FinTech",
      "Blockchain based financial technology",
      fundingGoal
    );

    await startupFunding
      .connect(investor1)
      .invest(1, {
        value: ethers.parseEther("5")
      });

    const startup =
      await startupFunding.getStartup(1);

    expect(startup[5]).to.equal(fundingGoal);

    expect(startup[6]).to.equal(false);
  });


  // =========================================================
  // TEST 6: INVESTMENT CANNOT EXCEED FUNDING GOAL
  // =========================================================

  it("should reject an investment that exceeds the funding goal", async function () {

    const {
      startupFunding,
      investor1,
      ethers
    } = await deployContract();

    const fundingGoal =
      ethers.parseEther("5");

    await startupFunding.createStartup(
      "AgriTech",
      "Blockchain based agriculture platform",
      fundingGoal
    );

    await expect(
      startupFunding
        .connect(investor1)
        .invest(1, {
          value: ethers.parseEther("6")
        })
    ).to.be.revertedWith(
      "Investment exceeds funding goal"
    );
  });

});