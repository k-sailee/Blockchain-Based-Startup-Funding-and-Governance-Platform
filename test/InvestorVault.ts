import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("InvestorVault", function () {
  it("accepts sfUSD deposits and issues redeemable sfVS shares", async function () {
    const [deployer, investor] = await ethers.getSigners();
    const token = await ethers.deployContract("MockToken");
    const vault = await ethers.deployContract("InvestorVault", [
      await token.getAddress(),
    ]);
    const depositAmount = ethers.parseUnits("100", 18);

    await token.transfer(investor.address, depositAmount);
    await token.connect(investor).approve(await vault.getAddress(), depositAmount);
    await vault.connect(investor).deposit(depositAmount, investor.address);

    expect(await token.balanceOf(investor.address)).to.equal(0n);
    expect(await vault.balanceOf(investor.address)).to.equal(depositAmount);
    expect(await vault.totalAssets()).to.equal(depositAmount);
    expect(await vault.totalSupply()).to.equal(depositAmount);

    const profit = ethers.parseUnits("20", 18);
    await token.transfer(await vault.getAddress(), profit);

    expect(await vault.totalAssets()).to.equal(depositAmount + profit);
    const redeemableAssets = await vault.previewRedeem(depositAmount);
    expect(await vault.convertToAssets(depositAmount)).to.equal(redeemableAssets);

    await vault.connect(investor).redeem(
      depositAmount,
      investor.address,
      investor.address,
    );

    expect(await vault.balanceOf(investor.address)).to.equal(0n);
    expect(await token.balanceOf(investor.address)).to.equal(redeemableAssets);
    expect(await token.balanceOf(deployer.address)).to.equal(
      1_000_000n * 10n ** 18n - depositAmount - profit,
    );
  });
});
