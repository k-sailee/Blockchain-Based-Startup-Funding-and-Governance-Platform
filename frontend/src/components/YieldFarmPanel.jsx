import { useState, useEffect, useRef } from "react";
import { BrowserProvider, Contract, formatEther, parseEther } from "ethers";
import {
  YIELD_FARM_CONTRACT_ADDRESS,
  YIELD_FARM_CONTRACT_ABI,
  LPT_TOKEN_ADDRESS,
  LPT_TOKEN_ABI,
  RWD_TOKEN_ADDRESS,
  RWD_TOKEN_ABI,
} from "../yieldFarmConfig";

export default function YieldFarmPanel({ account }) {
  const [lptBalance, setLptBalance] = useState("0");
  const [stakedBalance, setStakedBalance] = useState("0");
  const [pendingRewards, setPendingRewards] = useState("0");
  const [allowance, setAllowance] = useState("0");
  const [rewardPoolBalance, setRewardPoolBalance] = useState("0");

  const [stakeInput, setStakeInput] = useState("");
  const [withdrawInput, setWithdrawInput] = useState("");
  const [activeTab, setActiveTab] = useState("stake"); // 'stake' | 'withdraw' | 'exit'

  const [actionLoading, setActionLoading] = useState("");
  const [statusMessage, setStatusMessage] = useState(null); // { type, text, hash }
  const [txHistory, setTxHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(`yield_farm_tx_${account}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const pollTimerRef = useRef(null);

  // Helper to shorten addresses / tx hashes
  function shorten(str) {
    if (!str) return "";
    return `${str.slice(0, 8)}...${str.slice(-6)}`;
  }

  function addTxHistory(type, amount, hash) {
    const newEntry = {
      id: Date.now(),
      type,
      amount,
      hash,
      timestamp: new Date().toLocaleTimeString(),
    };
    setTxHistory((prev) => {
      const updated = [newEntry, ...prev.slice(0, 9)];
      try {
        localStorage.setItem(`yield_farm_tx_${account}`, JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save yield farm tx history", e);
      }
      return updated;
    });
  }

  // Load all yield farm and token balances
  async function loadYieldFarmData() {
    if (!window.ethereum || !account) return;
    if (!YIELD_FARM_CONTRACT_ADDRESS || !LPT_TOKEN_ADDRESS || !RWD_TOKEN_ADDRESS) {
      setStatusMessage({
        type: "error",
        text: "Yield farm contracts are not configured. Run the deployment script first.",
      });
      return;
    }

    try {
      const provider = new BrowserProvider(window.ethereum);
      const lptContract = new Contract(LPT_TOKEN_ADDRESS, LPT_TOKEN_ABI, provider);
      const rwdContract = new Contract(RWD_TOKEN_ADDRESS, RWD_TOKEN_ABI, provider);
      const farmContract = new Contract(
        YIELD_FARM_CONTRACT_ADDRESS,
        YIELD_FARM_CONTRACT_ABI,
        provider
      );

      const [userLpt, userStaked, userEarned, userAllowance, contractRwd] =
        await Promise.all([
          lptContract.balanceOf(account),
          farmContract.stakedBalance(account),
          farmContract.earned(account),
          lptContract.allowance(account, YIELD_FARM_CONTRACT_ADDRESS),
          rwdContract.balanceOf(YIELD_FARM_CONTRACT_ADDRESS),
        ]);

      setLptBalance(formatEther(userLpt));
      setStakedBalance(formatEther(userStaked));
      setPendingRewards(formatEther(userEarned));
      setAllowance(formatEther(userAllowance));
      setRewardPoolBalance(formatEther(contractRwd));
    } catch (err) {
      console.error("Error loading yield farm data:", err);
    }
  }

  // Refresh pending reward ticker
  async function refreshPendingReward() {
    if (!window.ethereum || !account || !YIELD_FARM_CONTRACT_ADDRESS) return;
    try {
      const provider = new BrowserProvider(window.ethereum);
      const farmContract = new Contract(
        YIELD_FARM_CONTRACT_ADDRESS,
        YIELD_FARM_CONTRACT_ABI,
        provider
      );
      const earned = await farmContract.earned(account);
      setPendingRewards(formatEther(earned));
    } catch {
      // Ignore background ticker fetch errors
    }
  }

  useEffect(() => {
    loadYieldFarmData();

    // Auto-refresh pending reward every 3 seconds for dynamic reward accumulation ticker
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(() => {
      refreshPendingReward();
    }, 3000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [account]);

  // Handle Approve LPT
  async function handleApprove() {
    if (!stakeInput || Number(stakeInput) <= 0) {
      setStatusMessage({ type: "error", text: "Please enter a valid amount to approve." });
      return;
    }

    try {
      setActionLoading("approving");
      setStatusMessage(null);

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const lptContract = new Contract(LPT_TOKEN_ADDRESS, LPT_TOKEN_ABI, signer);

      const amountToApprove = parseEther(stakeInput);
      const tx = await lptContract.approve(YIELD_FARM_CONTRACT_ADDRESS, amountToApprove);

      setStatusMessage({
        type: "info",
        text: "Approval transaction submitted. Awaiting confirmation...",
        hash: tx.hash,
      });

      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) {
        throw new Error("Approval transaction reverted or failed.");
      }

      setStatusMessage({
        type: "success",
        text: `Approved ${stakeInput} LPT successfully! You can now stake into the farm.`,
        hash: tx.hash,
      });

      addTxHistory("APPROVE", `${stakeInput} LPT`, tx.hash);
      await loadYieldFarmData();
    } catch (err) {
      console.error("Approval error:", err);
      if (err.code === 4001 || err.code === "ACTION_REJECTED") {
        setStatusMessage({ type: "error", text: "Approval rejected in MetaMask." });
      } else {
        setStatusMessage({
          type: "error",
          text: err.reason || err.shortMessage || err.message || "Failed to approve LPT tokens.",
        });
      }
    } finally {
      setActionLoading("");
    }
  }

  // Handle Stake LPT
  async function handleStake() {
    if (!stakeInput || Number(stakeInput) <= 0) {
      setStatusMessage({ type: "error", text: "Please enter a valid amount to stake." });
      return;
    }

    if (Number(stakeInput) > Number(lptBalance)) {
      setStatusMessage({
        type: "error",
        text: `Insufficient LPT balance. You have ${Number(lptBalance).toFixed(4)} LPT available.`,
      });
      return;
    }

    try {
      setActionLoading("staking");
      setStatusMessage(null);

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const farmContract = new Contract(
        YIELD_FARM_CONTRACT_ADDRESS,
        YIELD_FARM_CONTRACT_ABI,
        signer
      );

      const amountToStake = parseEther(stakeInput);

      // Simulation first
      await farmContract.stake.staticCall(amountToStake);

      let gasLimit;
      try {
        const estimatedGas = await farmContract.stake.estimateGas(amountToStake);
        gasLimit = (estimatedGas * 120n) / 100n;
      } catch (estimateError) {
        console.warn("Stake gas estimation fallback:", estimateError);
        gasLimit = 300000n;
      }

      const tx = await farmContract.stake(amountToStake, { gasLimit });

      setStatusMessage({
        type: "info",
        text: "Staking transaction submitted. Awaiting confirmation...",
        hash: tx.hash,
      });

      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) {
        throw new Error("Staking transaction reverted on chain.");
      }

      setStatusMessage({
        type: "success",
        text: `Successfully staked ${stakeInput} LPT into Yield Farm! RWD rewards are now accumulating.`,
        hash: tx.hash,
      });

      addTxHistory("STAKE", `${stakeInput} LPT`, tx.hash);
      setStakeInput("");
      await loadYieldFarmData();
    } catch (err) {
      console.error("Staking error:", err);
      if (err.code === 4001 || err.code === "ACTION_REJECTED") {
        setStatusMessage({ type: "error", text: "Staking rejected in MetaMask." });
      } else {
        setStatusMessage({
          type: "error",
          text: err.reason || err.shortMessage || err.message || "Staking transaction failed.",
        });
      }
    } finally {
      setActionLoading("");
    }
  }

  // Handle Withdraw LPT
  async function handleWithdraw() {
    if (!withdrawInput || Number(withdrawInput) <= 0) {
      setStatusMessage({
        type: "error",
        text: "Please enter a valid amount to withdraw.",
      });
      return;
    }

    if (Number(withdrawInput) > Number(stakedBalance)) {
      setStatusMessage({
        type: "error",
        text: `Withdrawal exceeds staked balance. You currently have ${Number(
          stakedBalance
        ).toFixed(4)} LPT staked.`,
      });
      return;
    }

    try {
      setActionLoading("withdrawing");
      setStatusMessage(null);

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const farmContract = new Contract(
        YIELD_FARM_CONTRACT_ADDRESS,
        YIELD_FARM_CONTRACT_ABI,
        signer
      );

      const amountToWithdraw = parseEther(withdrawInput);

      // Simulation first
      await farmContract.withdraw.staticCall(amountToWithdraw);

      let gasLimit;
      try {
        const estimatedGas = await farmContract.withdraw.estimateGas(amountToWithdraw);
        gasLimit = (estimatedGas * 120n) / 100n;
      } catch (estimateError) {
        console.warn("Withdraw gas estimation fallback:", estimateError);
        gasLimit = 300000n;
      }

      const tx = await farmContract.withdraw(amountToWithdraw, { gasLimit });

      setStatusMessage({
        type: "info",
        text: "Withdrawal transaction submitted. Awaiting confirmation...",
        hash: tx.hash,
      });

      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) {
        throw new Error("Withdrawal transaction did not succeed.");
      }

      setStatusMessage({
        type: "success",
        text: `Successfully withdrew ${withdrawInput} LPT! Accrued rewards are safely preserved.`,
        hash: tx.hash,
      });

      addTxHistory("WITHDRAW", `${withdrawInput} LPT`, tx.hash);
      setWithdrawInput("");
      await loadYieldFarmData();
    } catch (err) {
      console.error("Withdraw error:", err);
      if (err.code === 4001 || err.code === "ACTION_REJECTED") {
        setStatusMessage({
          type: "error",
          text: "Withdrawal rejected in MetaMask.",
        });
      } else {
        setStatusMessage({
          type: "error",
          text:
            err.reason ||
            err.shortMessage ||
            err.message ||
            "Withdrawal failed.",
        });
      }
    } finally {
      setActionLoading("");
    }
  }

  // Handle Harvest Rewards
  async function handleHarvest() {
    if (Number(pendingRewards) <= 0) {
      setStatusMessage({
        type: "error",
        text: "No rewards available to harvest at this time.",
      });
      return;
    }

    if (Number(rewardPoolBalance) < Number(pendingRewards)) {
      setStatusMessage({
        type: "error",
        text: "Yield farm reward pool is currently low. Contact admin to fund RWD tokens.",
      });
      return;
    }

    try {
      setActionLoading("harvesting");
      setStatusMessage(null);

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const farmContract = new Contract(
        YIELD_FARM_CONTRACT_ADDRESS,
        YIELD_FARM_CONTRACT_ABI,
        signer
      );

      // Simulation
      await farmContract.harvest.staticCall();

      let gasLimit;
      try {
        const estimatedGas = await farmContract.harvest.estimateGas();
        gasLimit = (estimatedGas * 120n) / 100n;
      } catch (estimateError) {
        console.warn("Harvest gas estimation fallback:", estimateError);
        gasLimit = 300000n;
      }

      const tx = await farmContract.harvest({ gasLimit });

      setStatusMessage({
        type: "info",
        text: "Harvest transaction submitted. Awaiting confirmation...",
        hash: tx.hash,
      });

      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) {
        throw new Error("Harvest transaction did not succeed.");
      }

      setStatusMessage({
        type: "success",
        text: `Successfully harvested ${Number(pendingRewards).toFixed(4)} RWD reward tokens!`,
        hash: tx.hash,
      });

      addTxHistory("HARVEST", `${Number(pendingRewards).toFixed(4)} RWD`, tx.hash);
      await loadYieldFarmData();
    } catch (err) {
      console.error("Harvest error:", err);
      if (err.code === 4001 || err.code === "ACTION_REJECTED") {
        setStatusMessage({ type: "error", text: "Harvest rejected in MetaMask." });
      } else {
        setStatusMessage({
          type: "error",
          text: err.reason || err.shortMessage || err.message || "Harvest rewards failed.",
        });
      }
    } finally {
      setActionLoading("");
    }
  }

  // Handle Exit (Withdraw All LPT & Harvest All RWD)
  async function handleExit() {
    if (Number(stakedBalance) <= 0 && Number(pendingRewards) <= 0) {
      setStatusMessage({
        type: "error",
        text: "No staked balance or pending rewards to exit.",
      });
      return;
    }

    try {
      setActionLoading("exiting");
      setStatusMessage(null);

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const farmContract = new Contract(
        YIELD_FARM_CONTRACT_ADDRESS,
        YIELD_FARM_CONTRACT_ABI,
        signer
      );

      // Simulation
      await farmContract.exit.staticCall();

      let gasLimit;
      try {
        const estimatedGas = await farmContract.exit.estimateGas();
        gasLimit = (estimatedGas * 120n) / 100n;
      } catch (estimateError) {
        console.warn("Exit gas estimation fallback:", estimateError);
        gasLimit = 300000n;
      }

      const tx = await farmContract.exit({ gasLimit });

      setStatusMessage({
        type: "info",
        text: "Exit transaction submitted. Awaiting confirmation...",
        hash: tx.hash,
      });

      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) {
        throw new Error("Exit transaction did not succeed.");
      }

      setStatusMessage({
        type: "success",
        text: `Exit complete! Withdrew ${Number(
          stakedBalance
        ).toFixed(4)} LPT and harvested all pending RWD rewards.`,
        hash: tx.hash,
      });

      addTxHistory(
        "EXIT",
        `${Number(stakedBalance).toFixed(2)} LPT + ${Number(pendingRewards).toFixed(2)} RWD`,
        tx.hash
      );
      setStakeInput("");
      setWithdrawInput("");
      await loadYieldFarmData();
    } catch (err) {
      console.error("Exit error:", err);
      if (err.code === 4001 || err.code === "ACTION_REJECTED") {
        setStatusMessage({ type: "error", text: "Exit transaction rejected in MetaMask." });
      } else {
        setStatusMessage({
          type: "error",
          text: err.reason || err.shortMessage || err.message || "Exit transaction failed.",
        });
      }
    } finally {
      setActionLoading("");
    }
  }

  // Local Faucet Helper: Mint 100 LPT for local testing simulation
  async function handleMintTestTokens() {
    try {
      setActionLoading("faucet");
      setStatusMessage(null);

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const lptContract = new Contract(LPT_TOKEN_ADDRESS, LPT_TOKEN_ABI, signer);

      const tx = await lptContract.mint(account, parseEther("100"));
      setStatusMessage({
        type: "info",
        text: "Minting 100 test LPT tokens to your wallet...",
        hash: tx.hash,
      });

      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) {
        throw new Error("Faucet minting transaction failed.");
      }

      setStatusMessage({
        type: "success",
        text: "Minted 100 test LP Tokens (LPT) to your wallet!",
        hash: tx.hash,
      });

      addTxHistory("MINT_FAUCET", "100 LPT", tx.hash);
      await loadYieldFarmData();
    } catch (err) {
      console.error("Mint error:", err);
      if (err.code === 4001 || err.code === "ACTION_REJECTED") {
        setStatusMessage({ type: "error", text: "Faucet transaction rejected in MetaMask." });
      } else {
        setStatusMessage({
          type: "error",
          text: err.reason || err.shortMessage || err.message || "Failed to mint test tokens.",
        });
      }
    } finally {
      setActionLoading("");
    }
  }

  const needsApproval =
    Number(stakeInput) > 0 && Number(allowance) < Number(stakeInput);

  return (
    <div className="staking-panel-container">
      {/* Notice Banner */}
      <div className="staking-banner" style={{ background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)", borderColor: "#a7f3d0" }}>
        <div>
          <span className="staking-badge" style={{ background: "#059669" }}>
            PART 1: YIELD FARMING (LP TOKEN STAKING)
          </span>
          <h3>LP Token Yield Farming</h3>
          <p>
            Stake Liquidity Provider tokens (<strong>LPT</strong>) to farm time-based protocol rewards (
            <strong>RWD</strong>) at <strong>0.001 RWD per LPT per second</strong>.
          </p>
        </div>
        <button
          className="faucet-btn"
          onClick={handleMintTestTokens}
          disabled={!!actionLoading}
          title="Mint 100 test LPT tokens for local testing"
        >
          {actionLoading === "faucet" ? "Minting..." : "🌾 Faucet: Get 100 LPT"}
        </button>
      </div>

      {/* Status / Alert Message */}
      {statusMessage && (
        <div className={`staking-alert ${statusMessage.type}`}>
          <div className="alert-content">
            <strong>
              {statusMessage.type === "success"
                ? "✓ Success: "
                : statusMessage.type === "error"
                ? "⚠ Error: "
                : "ℹ Notice: "}
            </strong>
            <span>{statusMessage.text}</span>
          </div>
          {statusMessage.hash && (
            <div className="alert-hash">
              <span>Tx Hash: </span>
              <code>{shorten(statusMessage.hash)}</code>
            </div>
          )}
        </div>
      )}

      {/* Metrics Row */}
      <div className="staking-stats-grid">
        <div className="staking-stat-card">
          <span className="stat-label">Available LPT</span>
          <strong className="stat-value">{Number(lptBalance).toFixed(4)}</strong>
          <span className="stat-sub">In your connected wallet</span>
        </div>

        <div className="staking-stat-card active-stake">
          <span className="stat-label">Staked LPT</span>
          <strong className="stat-value text-primary">{Number(stakedBalance).toFixed(4)}</strong>
          <span className="stat-sub">Currently farming rewards</span>
        </div>

        <div className="staking-stat-card reward-card">
          <span className="stat-label">Accrued Rewards</span>
          <div className="reward-value-row">
            <strong className="stat-value text-accent">
              {Number(pendingRewards).toFixed(5)}
            </strong>
            <span className="token-symbol">RWD</span>
            <span className="live-indicator" title="Accruing in real-time">● Live</span>
          </div>
          <span className="stat-sub">Rate: 0.001 RWD / LPT / sec</span>
        </div>

        <div className="staking-stat-card">
          <span className="stat-label">Farm Reward Pool</span>
          <strong className="stat-value">{Number(rewardPoolBalance).toFixed(2)}</strong>
          <span className="stat-sub">RWD available for farm payouts</span>
        </div>
      </div>

      {/* Action Workspace */}
      <div className="staking-workspace">
        {/* Navigation Tabs */}
        <div className="staking-tabs">
          <button
            className={`staking-tab-btn ${activeTab === "stake" ? "active" : ""}`}
            onClick={() => setActiveTab("stake")}
          >
            Stake LPT
          </button>
          <button
            className={`staking-tab-btn ${activeTab === "withdraw" ? "active" : ""}`}
            onClick={() => setActiveTab("withdraw")}
          >
            Withdraw LPT
          </button>
          <button
            className={`staking-tab-btn ${activeTab === "exit" ? "active" : ""}`}
            onClick={() => setActiveTab("exit")}
          >
            Exit & Harvest All
          </button>
        </div>

        {/* Tab 1: Stake LPT */}
        {activeTab === "stake" && (
          <div className="tab-pane">
            <div className="pane-header">
              <h4>Deposit & Stake LP Tokens (LPT)</h4>
              <p>Approve and transfer LPT tokens to the SimpleYieldFarm contract to start earning rewards.</p>
            </div>

            <div className="input-group-wrapper">
              <label>Amount to Stake</label>
              <div className="staking-input-row">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="0.0"
                  value={stakeInput}
                  onChange={(e) => setStakeInput(e.target.value)}
                  disabled={!!actionLoading}
                />
                <button
                  type="button"
                  className="max-btn"
                  onClick={() => setStakeInput(lptBalance)}
                >
                  MAX
                </button>
                <span className="unit">LPT</span>
              </div>
              <small className="input-hint">
                Wallet Balance: {Number(lptBalance).toFixed(4)} LPT | Allowance: {Number(allowance).toFixed(4)} LPT
              </small>
            </div>

            <div className="actions-row">
              {needsApproval ? (
                <button
                  className="staking-action-btn primary"
                  onClick={handleApprove}
                  disabled={actionLoading === "approving" || !stakeInput}
                >
                  {actionLoading === "approving" ? "Approving in Wallet..." : "Step 1: Approve LPT"}
                </button>
              ) : (
                <button
                  className="staking-action-btn primary"
                  onClick={handleStake}
                  disabled={actionLoading === "staking" || !stakeInput || Number(stakeInput) <= 0}
                >
                  {actionLoading === "staking" ? "Staking in Progress..." : "Stake LPT"}
                </button>
              )}

              <button
                className="staking-action-btn secondary"
                onClick={handleHarvest}
                disabled={actionLoading === "harvesting" || Number(pendingRewards) <= 0}
              >
                {actionLoading === "harvesting"
                  ? "Harvesting..."
                  : `Harvest Rewards (${Number(pendingRewards).toFixed(4)} RWD)`}
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Withdraw LPT */}
        {activeTab === "withdraw" && (
          <div className="tab-pane">
            <div className="pane-header">
              <h4>Withdraw Staked LP Tokens</h4>
              <p>Withdraw a portion of your staked LPT. Previously accrued rewards remain safely preserved.</p>
            </div>

            <div className="input-group-wrapper">
              <label>Amount to Withdraw</label>
              <div className="staking-input-row">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="0.0"
                  value={withdrawInput}
                  onChange={(e) => setWithdrawInput(e.target.value)}
                  disabled={!!actionLoading}
                />
                <button
                  type="button"
                  className="max-btn"
                  onClick={() => setWithdrawInput(stakedBalance)}
                >
                  MAX
                </button>
                <span className="unit">LPT</span>
              </div>
              <small className="input-hint">
                Currently Staked: {Number(stakedBalance).toFixed(4)} LPT
              </small>
            </div>

            <div className="actions-row">
              <button
                className="staking-action-btn primary"
                onClick={handleWithdraw}
                disabled={
                  actionLoading === "withdrawing" ||
                  !withdrawInput ||
                  Number(withdrawInput) <= 0 ||
                  Number(withdrawInput) > Number(stakedBalance)
                }
              >
                {actionLoading === "withdrawing" ? "Withdrawing..." : "Withdraw LPT"}
              </button>

              <button
                className="staking-action-btn secondary"
                onClick={handleHarvest}
                disabled={actionLoading === "harvesting" || Number(pendingRewards) <= 0}
              >
                {actionLoading === "harvesting"
                  ? "Harvesting..."
                  : `Harvest Rewards (${Number(pendingRewards).toFixed(4)} RWD)`}
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Exit & Harvest All */}
        {activeTab === "exit" && (
          <div className="tab-pane exit-pane">
            <div className="pane-header">
              <h4>Full Exit & Harvest Settlement</h4>
              <p>
                Withdraw all remaining staked LPT tokens and harvest 100% of pending RWD rewards in a
                single transaction.
              </p>
            </div>

            <div className="exit-summary-box">
              <div className="exit-summary-row">
                <span>Staked LPT to Return:</span>
                <strong>{Number(stakedBalance).toFixed(4)} LPT</strong>
              </div>
              <div className="exit-summary-row">
                <span>Accrued RWD to Harvest:</span>
                <strong className="text-accent">{Number(pendingRewards).toFixed(5)} RWD</strong>
              </div>
            </div>

            <div className="actions-row">
              <button
                className="staking-action-btn danger"
                onClick={handleExit}
                disabled={
                  actionLoading === "exiting" ||
                  (Number(stakedBalance) <= 0 && Number(pendingRewards) <= 0)
                }
              >
                {actionLoading === "exiting"
                  ? "Exiting Farm..."
                  : "Withdraw All & Harvest All (Exit)"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transaction History */}
      {txHistory.length > 0 && (
        <div className="staking-history-box">
          <div className="history-header">
            <h4>Recent Yield Farming Activity</h4>
            <button
              className="clear-history-btn"
              onClick={() => {
                setTxHistory([]);
                localStorage.removeItem(`yield_farm_tx_${account}`);
              }}
            >
              Clear
            </button>
          </div>
          <div className="history-list">
            {txHistory.map((item) => (
              <div className="history-item" key={item.id}>
                <div className="history-left">
                  <span className={`history-tag ${item.type.toLowerCase()}`}>{item.type}</span>
                  <span className="history-amount">{item.amount}</span>
                </div>
                <div className="history-right">
                  <span className="history-time">{item.timestamp}</span>
                  <code>{shorten(item.hash)}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
