# Blockchain-Based Startup Funding and Governance Platform

A decentralized Web3 platform enabling startup crowdfunding, DAO-based governance, and simulated decentralized finance (DeFi) mechanisms including **Protocol Token Staking** and **LP Token Yield Farming**.

---

## Table of Contents

1. [Platform Overview](#platform-overview)
2. [DeFi Experiment 5 — Part 1: LP Token Yield Farming](#defi-experiment-5--part-1-lp-token-yield-farming)
   - [What Yield Farming Simulates](#what-yield-farming-simulates)
   - [Difference Between LPT Staking and Protocol-Token Staking](#difference-between-lpt-staking-and-protocol-token-staking)
   - [Farming Rewards vs AMM Trading Fees vs Impermanent Loss](#farming-rewards-vs-amm-trading-fees-vs-impermanent-loss)
   - [Contract Architecture](#contract-architecture)
   - [Reward Calculation Formula](#reward-calculation-formula)
3. [Smart Contracts Summary](#smart-contracts-summary)
4. [Deployment Steps](#deployment-steps)
5. [Ganache and MetaMask Configuration](#ganache-and-metamask-configuration)
6. [How to Run Automated Tests](#how-to-run-automated-tests)
7. [How to Execute Stake, Harvest, Withdraw, and Exit](#how-to-execute-stake-harvest-withdraw-and-exit)
8. [Diagnostic and Verification Scripts](#diagnostic-and-verification-scripts)

---

## Platform Overview

Blockchain-Based Startup Funding and Governance Platform combines decentralized crowdfunding with a shareholder voting mechanism. Founders register startups, set funding goals in ETH, and raise funds from community investors. When milestones are met or funding goals are reached, governance decisions are managed transparently via smart contracts.

---

## DeFi Experiment 5 — Part 1: LP Token Yield Farming

### What Yield Farming Simulates

In decentralized finance (DeFi), **Yield Farming** (or Liquidity Mining) incentivizes users to deposit liquidity provider (LP) tokens into a farming contract to earn protocol reward tokens (such as governance or reward tokens). 

In this educational simulation:
- **LP Token (`LPT`)** simulates a liquidity-pair token that a liquidity provider would receive after depositing assets into an Automated Market Maker (AMM) liquidity pool.
- **Reward Token (`RWD`)** represents the incentive token distributed by the protocol to yield farmers over time.
- **SimpleYieldFarm (`SimpleYieldFarm.sol`)** is the staking contract that holds the deposited `LPT`, tracks block timestamps, and calculates accrued `RWD` rewards.

> [!NOTE]
> `LPT` is an educational mock ERC-20 token simulating an LP token. There is no actual AMM pool, token pair swap, or automated liquidity rebalancing in this lab. Consequently, this simulation does **not** calculate real AMM price slippage or impermanent loss.

---

### Difference Between LPT Staking and Protocol-Token Staking

| Feature | DeFi Part 1: LP Token Yield Farming | DeFi Part 2: Protocol Token Staking |
| :--- | :--- | :--- |
| **Staked Asset** | Mock LP Token (`LPT`), representing AMM liquidity provision | Platform Token (`ABC`), representing native governance or utility |
| **Primary Economic Purpose** | Incentivize external liquidity provision to keep decentralized markets liquid | Align long-term token holders with protocol health and reduce circulating sell pressure |
| **Risk Profile in Real DeFi** | Exposed to underlying token price movements and impermanent loss (IL) | Exposed solely to the price volatility of the staked protocol asset |
| **Smart Contract** | `SimpleYieldFarm.sol` | `SimpleStaking.sol` |
| **Reward Distribution** | Harvested reward tokens (`RWD`) | Protocol reward tokens (`RWD`) |

---

### Farming Rewards vs AMM Trading Fees vs Impermanent Loss

In a production DeFi ecosystem with Automated Market Makers (e.g., Uniswap, Sushiswap):
1. **AMM Trading Fees**: When traders swap tokens through an AMM pool, a small fee (e.g., 0.3%) is collected and added to the pool reserves. Liquidity providers earn this proportional fee automatically as their LP tokens appreciate in value relative to the underlying pool reserves.
2. **Farming Rewards (Liquidity Mining)**: To bootstrap new pools, protocols distribute secondary reward tokens (`RWD`) to users who deposit their LP tokens into a farming smart contract (`SimpleYieldFarm`). This yield is an active distribution paid over time on top of trading fees.
3. **Impermanent Loss (IL)**: Occurs when the price ratio of pooled tokens changes compared to when they were deposited. If one token surges while another remains flat, arbitrageurs drain the higher-value token until prices equalize, resulting in less total value for the LP than if they had simply held both assets outside the pool.

*In this simulation, we focus specifically on the mechanics of depositing LP tokens, accounting for time-based farming reward distribution, and settling positions.*

---

### Contract Architecture

Part 1 consists of two Solidity source files:
- `contracts/MockERC20.sol`: Deployed twice — once for `LP Token` (`LPT`) and once for `Reward Token` (`RWD`).
- `contracts/SimpleYieldFarm.sol`: Manages staking, balance updates, reward calculation, harvesting, and withdrawals.

#### SimpleYieldFarm State and Mappings:
- `stakingToken`: Address of the `LPT` ERC-20 token.
- `rewardToken`: Address of the `RWD` ERC-20 token.
- `rewardRate`: Scaled reward rate (`1e15`, representing `0.001 RWD per LPT per second`).
- `stakedBalance[user]`: Current quantity of `LPT` staked by `user`.
- `lastUpdate[user]`: Block timestamp when `user` rewards were last accounted.
- `pendingReward[user]`: Stored accumulated rewards before subsequent balance changes.

#### Function Interface:
1. `constructor(address _stakingToken, address _rewardToken)`: Validates distinct non-zero token addresses and initializes the reward rate.
2. `stake(uint256 amount)`: Accrues pending rewards, transfers `LPT` into the contract, increases recorded stake, and emits `Staked(user, amount)`.
3. `earned(address user) view returns (uint256)`: Computes stored pending rewards plus newly accrued rewards since `lastUpdate[user]`.
4. `harvest()`: Updates reward accounting, clears `pendingReward`, and transfers `RWD` to the caller, emitting `RewardPaid(user, reward)`.
5. `withdraw(uint256 amount)`: Updates reward accounting, decrements recorded stake, transfers `LPT` back to caller, and emits `Withdrawn(user, amount)`.
6. `exit()`: Withdraws 100% of remaining staked `LPT` and harvests all pending `RWD` in a single transaction.

---

### Reward Calculation Formula

Rewards are computed with integer math using a scaled reward rate:

$$\text{Newly Accrued Reward} = \frac{\text{stakedBalance}[user] \times \text{rewardRate} \times (\text{block.timestamp} - \text{lastUpdate}[user])}{10^{18}}$$

$$\text{Total Earned} = \text{pendingReward}[user] + \text{Newly Accrued Reward}$$

- **Reward Rate**: $0.001 \text{ RWD per LPT per second} = 10^{15} \text{ (scaled by } 10^{18}\text{)}$
- **Example**:
  - Staked amount: $100 \text{ LPT}$ ($100 \times 10^{18}$)
  - Elapsed time: $60 \text{ seconds}$
  - Expected reward: $\frac{100 \times 10^{18} \times 10^{15} \times 60}{10^{18}} = 6 \times 10^{18} = 6.0 \text{ RWD}$

---

## Deployment Steps

### 1. Start Ganache Local Blockchain
Ensure Ganache is running on:
- **RPC Server**: `http://127.0.0.1:7545`
- **Network ID / Chain ID**: `1337` (or Ganache default `5777`/`1337`)

### 2. Deploy Part 1 Yield Farm
Run the standalone deployment script:
```bash
npx hardhat run scripts/deploy-yield-farm.ts --network ganache
```
This script:
1. Deploys `MockERC20` as `LP Token (LPT)`.
2. Deploys `MockERC20` as `Reward Token (RWD)`.
3. Deploys `SimpleYieldFarm` with LPT and RWD addresses.
4. Mints an initial 100 LPT to the deployer.
5. Funds the farm with 100,000 RWD reward tokens.
6. Writes configuration to `frontend/src/yieldFarmConfig.js`.
7. Copies the contract ABI to `frontend/src/contracts/SimpleYieldFarm.json`.

*(Part 2 deployment in `scripts/deploy.ts` and `frontend/src/contractConfig.js` remains completely separate and untouched).*

---

## Ganache and MetaMask Configuration

1. In MetaMask, add or select a custom network:
   - **Network Name**: `Ganache Local`
   - **RPC URL**: `http://127.0.0.1:7545`
   - **Chain ID**: `1337`
   - **Currency Symbol**: `ETH`
2. Import the deployer test account private key into MetaMask:
   - Private Key: `0x94f1bd2634b82458be816d47c2a394974313ba653adf0ae0f67456735f8874cb`
   - Account Address: `0xA10989ad0b6e9BcA41693Fd588217010A5375ace`
3. In MetaMask, import the custom ERC-20 tokens:
   - **LP Token (LPT)**: Address printed in `frontend/src/yieldFarmConfig.js`
   - **Reward Token (RWD)**: Address printed in `frontend/src/yieldFarmConfig.js`

---

## How to Run Automated Tests

Run the full Hardhat test suite (includes Part 1, Part 2, and Core Funding tests):
```bash
npx hardhat test
```
The test suite includes:
- **22 automated tests for SimpleYieldFarm** (`test/SimpleYieldFarm.ts`) verifying constructor validations, staking, rewards accrual over time, partial withdrawals, harvest, full exit, underfunded farm safety, allowance checks, and reentrancy protection.
- **10 automated tests for SimpleStaking** (`test/SimpleStaking.ts`).
- **6 automated tests for StartupFunding** (`test/StartupFunding.ts`).

---

## How to Execute Stake, Harvest, Withdraw, and Exit

### Via the Web Frontend

1. Start the React frontend:
   ```bash
   cd frontend
   npm run dev
   ```
2. Open the application in your browser (e.g., `http://localhost:5173`).
3. Connect MetaMask to the local Ganache network (`1337`).
4. Click **I'm an Investor →**.
5. In the top subnav, click **🌾 Yield Farming (DeFi Part 1)**.
6. Actions available:
   - **Faucet**: Click `🌾 Faucet: Get 100 LPT` to mint test LPT.
   - **Approve**: Enter amount to stake, then click `Step 1: Approve LPT`.
   - **Stake**: Once approved, click `Stake LPT`. Observe rewards accumulating live in real time.
   - **Harvest Rewards**: Click `Harvest Rewards (X.XXXX RWD)` to claim your accumulated RWD without unstaking.
   - **Withdraw LPT**: Switch to the **Withdraw LPT** tab, input the quantity to withdraw, and click `Withdraw LPT`.
   - **Exit & Harvest All**: Switch to the **Exit & Harvest All** tab, review summary, and click `Withdraw All & Harvest All (Exit)` to withdraw all LPT and claim all RWD in one transaction.

---

## Diagnostic and Verification Scripts

### 1. Diagnostic Script
Inspect on-chain balances, staked balances, allowances, and reward rates:
```bash
npx hardhat run scripts/check-yield-farm.ts --network ganache
```

### 2. End-to-End Automated Verification Script
Run the complete 16-step transaction lifecycle demonstration:
```bash
node --experimental-strip-types ./scripts/verify-e2e-flow.ts
```
This script exercises:
1. Minting test LPT
2. Checking LPT balance
3. Approving SimpleYieldFarm
4. Staking 100 LPT
5. Verifying staked balance
6. Fast-forwarding 60 seconds
7. Verifying ~6 RWD accrued
8. Harvesting rewards
9. Advancing 30 seconds
10. Withdrawing 40 LPT
11. Verifying wallet balance increases and remaining stake is 60 LPT
12. Checking preserved reward accounting
13. Calling `exit()`
14. Verifying final wallet balances
15. Confirming user's staked balance and pending rewards are 0
16. Confirming the farm retains its remaining reward pool