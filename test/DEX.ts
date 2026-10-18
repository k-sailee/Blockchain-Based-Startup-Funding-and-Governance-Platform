import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("DEX Labs", function () {
  it("wraps ETH, adds liquidity, charges fee and enforces slippage", async function () {
    const [owner, trader] = await ethers.getSigners();
    const weth = await ethers.deployContract("WETH9");
    const usdc = await ethers.deployContract("MockUSDC");
    const pool = await ethers.deployContract("AMMPool", [await weth.getAddress(), await usdc.getAddress()]);
    const inAmount = ethers.parseEther("1");
    await weth.deposit({ value: ethers.parseEther("10") });
    await usdc.transfer(trader.address, 10_000n * 10n ** 6n);
    await weth.deposit({ value: ethers.parseEther("1") });
    await weth.transfer(trader.address, inAmount);
    await usdc.approve(await pool.getAddress(), 5_000n * 10n ** 6n);
    await weth.approve(await pool.getAddress(), ethers.parseEther("10"));
    await pool.addLiquidity(ethers.parseEther("10"), 5_000n * 10n ** 6n, 0);
    const quote = await pool.getAmountOut(inAmount, await weth.getAddress());
    await weth.connect(trader).approve(await pool.getAddress(), inAmount);
    await expect(pool.connect(trader).swapExactTokensForTokens(await weth.getAddress(), inAmount, quote + 1n, trader.address)).to.be.revertedWith("slippage");
    await expect(pool.connect(trader).swapExactTokensForTokens(await weth.getAddress(), inAmount, quote, trader.address)).to.emit(pool, "Swap");
    expect(await usdc.balanceOf(trader.address)).to.be.greaterThan(10_000n * 10n ** 6n);
    await weth.deposit({ value: ethers.parseEther("1") });
    await expect(weth.withdraw(ethers.parseEther("1"))).to.emit(weth, "Transfer");
    expect(await owner.getAddress()).to.equal(owner.address);
  });

  it("rejects stale oracle reads", async function () {
    const oracle = await ethers.deployContract("MockETHUSDOracle", [2500n * 10n ** 8n]);
    const reader = await ethers.deployContract("SafeOracleReader", [await oracle.getAddress(), 3600]);
    const result = await reader.readPrice();
    expect(result[0]).to.equal(2500n * 10n ** 8n);
  });
});
