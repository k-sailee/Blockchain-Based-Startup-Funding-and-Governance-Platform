import { network } from "hardhat";

const GANACHE_CHAIN_ID = 1337;
const MOCK_ORACLE_ADDRESS = "0x3e014816C849aBD0ddf4f2D00cF4767Eb6BA0fa0";
const SAFE_READER_ADDRESS = "0x98B084740438068F5c157e00D9c292033816E300";
const PRICE_STEP = 50000000000n;
const MAX_AGE = 3600n;

const oracleAbi = [
  "function owner() view returns(address)",
  "function decimals() view returns(uint8)",
  "function latestRoundData() view returns(uint80,int256,uint256,uint256,uint80)",
  "function setPrice(int256)",
];
const readerAbi = [
  "function feed() view returns(address)",
  "function maxAge() view returns(uint256)",
  "function readPrice() view returns(uint256,uint8)",
];

const { ethers } = await network.create({
  network: "ganache",
  chainType: "l1",
});

const checks: { name: string; passed: boolean; detail: string }[] = [];
function pass(name: string, detail: string) {
  checks.push({ name, passed: true, detail });
}
function fail(name: string, detail: string) {
  checks.push({ name, passed: false, detail });
}
function formatError(error: unknown) {
  if (error && typeof error === "object" && "shortMessage" in error) {
    return String(error.shortMessage);
  }
  if (error && typeof error === "object" && "reason" in error) {
    return String(error.reason);
  }
  return error instanceof Error ? error.message : String(error);
}

async function setPriceAndVerifyTransaction(price: bigint) {
  const estimatedGas = await oracle.setPrice.estimateGas(price);
  const latestBlock = await ethers.provider.getBlock("latest");
  if (!latestBlock) throw new Error("Unable to read the latest Ganache block.");
  const gasLimit = estimatedGas * 2n;
  if (gasLimit > latestBlock.gasLimit) {
    throw new Error(
      `Estimated gas ${estimatedGas} requires ${gasLimit}, above block gas limit ${latestBlock.gasLimit}.`,
    );
  }
  const tx = await oracle.setPrice(price, { gasLimit });
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error(`setPrice transaction ${tx.hash} was not confirmed successfully.`);
  }
  return { estimatedGas, gasLimit, blockGasLimit: latestBlock.gasLimit, txHash: tx.hash };
}

const actualChainId = Number((await ethers.provider.getNetwork()).chainId);
if (actualChainId === GANACHE_CHAIN_ID) {
  pass("Chain ID", `Connected to Ganache chain ${actualChainId}`);
} else {
  fail("Chain ID", `Expected ${GANACHE_CHAIN_ID}, received ${actualChainId}`);
}

const [signer] = await ethers.getSigners();
const oracle = new ethers.Contract(MOCK_ORACLE_ADDRESS, oracleAbi, signer);
const reader = new ethers.Contract(SAFE_READER_ADDRESS, readerAbi, signer);
let initialPrice: bigint | undefined;
let nextPrice: bigint | undefined;

try {
  const [owner, decimals, rawData, configuredFeed, maxAge] = await Promise.all([
    oracle.owner(),
    oracle.decimals(),
    oracle.latestRoundData(),
    reader.feed(),
    reader.maxAge(),
  ]);
  if (owner.toLowerCase() === signer.address.toLowerCase()) {
    pass("Authorized setter", `Signer ${signer.address} is the mock oracle owner`);
  } else {
    fail("Authorized setter", `Signer ${signer.address} is not owner ${owner}`);
  }
  if (configuredFeed.toLowerCase() === MOCK_ORACLE_ADDRESS.toLowerCase()) {
    pass("Reader feed", `SafeOracleReader uses ${configuredFeed}`);
  } else {
    fail("Reader feed", `Expected ${MOCK_ORACLE_ADDRESS}, received ${configuredFeed}`);
  }
  if (maxAge === MAX_AGE) {
    pass("Freshness configuration", `maxAge is ${maxAge} seconds`);
  } else {
    fail("Freshness configuration", `Expected ${MAX_AGE}, received ${maxAge}`);
  }
  pass(
    "Initial mock feed",
    `price=${rawData[1].toString()}, decimals=${decimals}, updatedAt=${rawData[3].toString()}`,
  );
  const observedInitialPrice = rawData[1];
  initialPrice = observedInitialPrice;
  if (observedInitialPrice <= 0n) {
    fail("Initial mock feed", `Invalid non-positive price ${observedInitialPrice.toString()}`);
  } else {
    nextPrice = observedInitialPrice + PRICE_STEP;
  }
  const initialReaderData = await reader.readPrice();
  if (initialReaderData[0] === rawData[1] && Number(initialReaderData[1]) === Number(decimals)) {
    pass(
      "Initial SafeOracleReader read",
      `price=${initialReaderData[0].toString()}, decimals=${initialReaderData[1]}`,
    );
  } else {
    fail("Initial SafeOracleReader read", "Reader output did not match the mock feed");
  }
} catch (error) {
  fail("Initial oracle verification", formatError(error));
}

try {
  if (initialPrice === undefined || nextPrice === undefined) {
    throw new Error("Initial price was not captured, so no dynamic update price could be calculated.");
  }
  const transaction = await setPriceAndVerifyTransaction(nextPrice);
  const updatedRawData = await oracle.latestRoundData();
  const updatedReaderData = await reader.readPrice();
  if (updatedRawData[1] !== initialPrice) {
    if (updatedRawData[1] === nextPrice) {
      pass(
        "Mock price update",
        `initial=${initialPrice.toString()}, new=${nextPrice.toString()}, updated=${updatedRawData[1].toString()}, tx=${transaction.txHash}, estimatedGas=${transaction.estimatedGas}, gasLimit=${transaction.gasLimit}, blockGasLimit=${transaction.blockGasLimit}`,
      );
    } else {
      fail("Mock price update", `Expected ${nextPrice}, received ${updatedRawData[1]}`);
    }
  } else {
    fail("Mock price update", `Updated price ${updatedRawData[1]} did not differ from initial price ${initialPrice}`);
  }
  if (updatedReaderData[0] !== initialPrice && updatedReaderData[0] === nextPrice) {
    pass(
      "Updated reader price",
      `initial=${initialPrice.toString()}, new=${nextPrice.toString()}, reader=${updatedReaderData[0].toString()}`,
    );
  } else {
    fail("Updated reader price", `Expected ${nextPrice} and a change from ${initialPrice}, received ${updatedReaderData[0]}`);
  }
} catch (error) {
  fail("Mock price update", formatError(error));
}

try {
  const invalidTransaction = await oracle.setPrice(0);
  const invalidReceipt = await invalidTransaction.wait();
  if (!invalidReceipt || invalidReceipt.status !== 1) {
    pass("Invalid price rejection", `setPrice(0) transaction was rejected: ${invalidTransaction.hash}`);
  } else {
    fail("Invalid price rejection", "setPrice(0) unexpectedly succeeded");
  }
} catch (error) {
  pass("Invalid price rejection", `setPrice(0) reverted: ${formatError(error)}`);
}

try {
  await ethers.provider.send("evm_increaseTime", [Number(MAX_AGE + 1n)]);
  await ethers.provider.send("evm_mine", []);
  await reader.readPrice();
  fail("Stale price rejection", "SafeOracleReader unexpectedly accepted stale data");
} catch (error) {
  pass("Stale price rejection", `readPrice() reverted: ${formatError(error)}`);
}

try {
  if (nextPrice === undefined) {
    throw new Error("Dynamic update price was not calculated.");
  }
  const recoveryPrice = nextPrice + PRICE_STEP;
  const transaction = await setPriceAndVerifyTransaction(recoveryPrice);
  const recoveryRawData = await oracle.latestRoundData();
  const freshReaderData = await reader.readPrice();
  if (recoveryRawData[1] === recoveryPrice && freshReaderData[0] === recoveryPrice) {
    pass(
      "Freshness recovery",
      `recoveryPrice=${recoveryPrice}, direct=${recoveryRawData[1]}, reader=${freshReaderData[0]}, tx=${transaction.txHash}; confirmed update restored readable data`,
    );
  } else {
    fail(
      "Freshness recovery",
      `Expected direct and reader price ${recoveryPrice}, received direct=${recoveryRawData[1]}, reader=${freshReaderData[0]}`,
    );
  }
} catch (error) {
  fail("Freshness recovery", formatError(error));
}

const failedChecks = checks.filter((check) => !check.passed);
console.log("\n=== Ganache Mock Oracle Verification ===");
console.log(`MockETHUSDOracle: ${MOCK_ORACLE_ADDRESS}`);
console.log(`SafeOracleReader: ${SAFE_READER_ADDRESS}`);
for (const check of checks) {
  console.log(`${check.passed ? "PASS" : "FAIL"} | ${check.name} | ${check.detail}`);
}
console.log(`=== Result: ${failedChecks.length === 0 ? "PASS" : "FAIL"} (${checks.length - failedChecks.length}/${checks.length}) ===`);

if (failedChecks.length > 0) {
  process.exitCode = 1;
}
