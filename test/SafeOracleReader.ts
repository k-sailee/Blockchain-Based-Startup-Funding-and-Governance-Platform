import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();

describe("SafeOracleReader", function () {
  async function deployFixture() {
    const feed = await ethers.deployContract("MockAggregatorV3", [
      8,
      "ETH / USD",
      3000n * 10n ** 8n,
    ]);
    const reader = await ethers.deployContract("SafeOracleReader", [
      await feed.getAddress(),
      3600,
    ]);
    return { feed, reader };
  }

  it("reads a valid price and feed metadata", async function () {
    const { feed, reader } = await deployFixture();
    const result = await reader.latestPriceData();
    expect(result[0]).to.equal(3000n * 10n ** 8n);
    expect(result[1]).to.equal(8);
    expect(result[3]).to.equal("ETH / USD");
    expect(await reader.feed()).to.equal(await feed.getAddress());
  });

  it("converts wei to USD with 18 decimal output", async function () {
    const { reader } = await deployFixture();
    expect(await reader.ethToUsd(ethers.parseEther("0.5"))).to.equal(
      ethers.parseUnits("1500", 18),
    );
  });

  it("rejects zero, negative, zero-timestamp, future, and stale data", async function () {
    const { feed, reader } = await deployFixture();
    await feed.setAnswer(0);
    await expect(reader.readPrice()).to.be.revertedWithCustomError(reader, "InvalidPrice");
    await feed.setAnswer(-1);
    await expect(reader.readPrice()).to.be.revertedWithCustomError(reader, "InvalidPrice");
    await feed.setRoundData(3000n * 10n ** 8n, 0);
    await expect(reader.readPrice()).to.be.revertedWithCustomError(reader, "InvalidTimestamp");
    const latest = BigInt(await networkHelpers.time.latest());
    await feed.setRoundData(3000n * 10n ** 8n, latest + 100n);
    await expect(reader.readPrice()).to.be.revertedWithCustomError(reader, "InvalidTimestamp");
    await feed.setRoundData(3000n * 10n ** 8n, latest - 3601n);
    await expect(reader.readPrice()).to.be.revertedWithCustomError(reader, "StalePrice");
  });

  it("rejects invalid constructor configuration", async function () {
    await expect(
      ethers.deployContract("SafeOracleReader", [ethers.ZeroAddress, 3600]),
    ).to.be.revert(ethers);
    const feed = await ethers.deployContract("MockAggregatorV3", [8, "ETH / USD", 1]);
    await expect(
      ethers.deployContract("SafeOracleReader", [await feed.getAddress(), 0]),
    ).to.be.revert(ethers);
  });
});
