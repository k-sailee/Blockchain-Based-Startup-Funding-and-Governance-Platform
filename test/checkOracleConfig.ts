import { expect } from "chai";
import {
  GANACHE_FEED,
  GANACHE_READER,
  GANACHE_CHAIN_ID,
  SEPOLIA_FEED,
  SEPOLIA_CHAIN_ID,
  resolveOracleTarget,
} from "../scripts/oracleVerificationConfig.js";

describe("checkOracle network selection", function () {
  it("selects Ganache mock oracle for chain ID 1337", function () {
    expect(resolveOracleTarget("ganache", GANACHE_CHAIN_ID)).to.deep.equal({
      network: "ganache",
      chainId: GANACHE_CHAIN_ID,
      readerAddress: GANACHE_READER,
      feedAddress: GANACHE_FEED,
      feedName: "MockETHUSDOracle",
    });
  });

  it("selects Sepolia Chainlink oracle for chain ID 11155111", function () {
    const reader = "0x9e78cDB124703E57686E9363D3B152E2cE99e1f8";
    expect(resolveOracleTarget("sepolia", SEPOLIA_CHAIN_ID, reader)).to.deep.equal({
      network: "sepolia",
      chainId: SEPOLIA_CHAIN_ID,
      readerAddress: reader,
      feedAddress: SEPOLIA_FEED,
      feedName: "Chainlink ETH/USD",
    });
  });

  it("rejects a network and chain ID mismatch", function () {
    expect(() => resolveOracleTarget("ganache", SEPOLIA_CHAIN_ID)).to.throw(
      "Unsupported oracle target",
    );
  });

  it("rejects missing Sepolia deployment address", function () {
    expect(() => resolveOracleTarget("sepolia", SEPOLIA_CHAIN_ID)).to.throw(
      "Missing Sepolia SafeOracleReader address",
    );
  });
});
