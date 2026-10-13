import { useState, useEffect, useRef } from "react";
import { BrowserProvider, Contract, formatEther, parseEther } from "ethers";
import {
  STAKING_CONTRACT_ADDRESS,
  STAKING_CONTRACT_ABI,
  ABC_TOKEN_ADDRESS,
  ABC_TOKEN_ABI,
  RWD_TOKEN_ADDRESS,
  RWD_TOKEN_ABI,
} from "../contractConfig";

export default function StakingPanel({ account }) {
  const [abcBalance, setAbcBalance] = useState("0");
  const [stakedBalance, setStakedBalance] = useState("0");
  const [pendingRewards, setPendingRewards] = useState("0");
  const [allowance, setAllowance] = useState("0");
  const [rewardPoolBalance, setRewardPoolBalance] = useState("0");

  const [stakeInput, setStakeInput] = useState("");
  const [unstakeInput, setUnstakeInput] = useState("");
  const [activeTab, setActiveTab] = useState("stake"); // 'stake' | 'unstake' | 'exit'

  const [actionLoading, setActionLoading] = useState("");
  const [statusMessage, setStatusMessage] = useState(null); // { type, text, hash }
  const [txHistory, setTxHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(`staking_tx_${account}`);
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
        localStorage.setItem(`staking_tx_${account}`, JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save tx history", e);
      }
      return updated;
    });
  }

  // Load all staking and token balances
  async function loadStakingData() {
    if (!window.ethereum || !account) return;
    if (!STAKING_CONTRACT_ADDRESS || !ABC_TOKEN_ADDRESS || !RWD_TOKEN_ADDRESS) {
      setStatusMessage({
        type: "error",
        text: "Staking contracts are not configured. Run the deployment script first.",
      });
      return;
    }

    try {
      const provider = new BrowserProvider(window.ethereum);
      const abcContract = new Contract(ABC_TOKEN_ADDRESS, ABC_TOKEN_ABI, provider);
      const rwdContract = new Contract(RWD_TOKEN_ADDRESS, RWD_TOKEN_ABI, provider);
      const stakingContract = new Contract(
        STAKING_CONTRACT_ADDRESS,
        STAKING_CONTRACT_ABI,
        provider
      );

      const [userAbc, userStaked, userEarned, userAllowance, contractRwd] =
        await Promise.all([
          abcContract.balanceOf(account),
          stakingContract.stakedBalance(account),
          stakingContract.earned(account),
          abcContract.allowance(account, STAKING_CONTRACT_ADDRESS),
          rwdContract.balanceOf(STAKING_CONTRACT_ADDRESS),
        ]);

      setAbcBalance(formatEther(userAbc));
      setStakedBalance(formatEther(userStaked));
      setPendingRewards(formatEther(userEarned));
      setAllowance(formatEther(userAllowance));
      setRewardPoolBalance(formatEther(contractRwd));
    } catch (err) {
      console.error("Error loading staking data:", err);
    }
  }

  // Refresh pending reward ticker
  async function refreshPendingReward() {
    if (!window.ethereum || !account || !STAKING_CONTRACT_ADDRESS) return;
    try {
      const provider = new BrowserProvider(window.ethereum);
      const stakingContract = new Contract(
        STAKING_CONTRACT_ADDRESS,
        STAKING_CONTRACT_ABI,
        provider
      );
      const earned = await stakingContract.earned(account);
      setPendingRewards(formatEther(earned));
    } catch {
      // Ignore background ticker fetch errors
    }
  }

  useEffect(() => {
    loadStakingData();

    // Auto-refresh pending reward every 3 seconds for dynamic reward accumulation
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(() => {
      refreshPendingReward();
    }, 3000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [account]);

  // Handle Approve ABC
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
      const abcContract = new Contract(ABC_TOKEN_ADDRESS, ABC_TOKEN_ABI, signer);

      const amountToApprove = parseEther(stakeInput);
      const tx = await abcContract.approve(STAKING_CONTRACT_ADDRESS, amountToApprove);

      setStatusMessage({
        type: "info",
        text: "Approval transaction submitted. Awaiting confirmation...",
        hash: tx.hash,
      });

      await tx.wait();

      setStatusMessage({
        type: "success",
        text: `Approved ${stakeInput} ABC successfully! You can now stake.`,
        hash: tx.hash,
      });

      addTxHistory("APPROVE", `${stakeInput} ABC`, tx.hash);
      await loadStakingData();
    } catch (err) {
      console.error("Approval error:", err);
      if (err.code === 4001) {
        setStatusMessage({ type: "error", text: "Approval rejected in MetaMask." });
      } else {
        setStatusMessage({
          type: "error",
          text: err.reason || err.message || "Failed to approve ABC tokens.",
        });
      }
    } finally {
      setActionLoading("");
    }
  }

  // Handle Stake ABC
  async function handleStake() {
    if (!stakeInput || Number(stakeInput) <= 0) {
      setStatusMessage({ type: "error", text: "Please enter a valid amount to stake." });
      return;
    }

    if (Number(stakeInput) > Number(abcBalance)) {
      setStatusMessage({
        type: "error",
        text: `Insufficient ABC balance. You have ${Number(abcBalance).toFixed(4)} ABC available.`,
      });
      return;
    }

    try {
      setActionLoading("staking");
      setStatusMessage(null);

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const stakingContract = new Contract(
        STAKING_CONTRACT_ADDRESS,
        STAKING_CONTRACT_ABI,
        signer
      );

      const amountToStake = parseEther(stakeInput);
      const tx = await stakingContract.stake(amountToStake);

      setStatusMessage({
        type: "info",
        text: "Staking transaction submitted. Awaiting confirmation...",
        hash: tx.hash,
      });

      await tx.wait();

      setStatusMessage({
        type: "success",
        text: `Successfully staked ${stakeInput} ABC! Rewards are now accumulating.`,
        hash: tx.hash,
      });

      addTxHistory("STAKE", `${stakeInput} ABC`, tx.hash);
      setStakeInput("");
      await loadStakingData();
    } catch (err) {
      console.error("Staking error:", err);
      if (err.code === 4001) {
        setStatusMessage({ type: "error", text: "Staking rejected in MetaMask." });
      } else {
        setStatusMessage({
          type: "error",
          text: err.reason || err.message || "Staking transaction failed.",
        });
      }
    } finally {
      setActionLoading("");
    }
  }

  // Handle Unstake ABC
 
// Handle Unstake ABC
async function handleUnstake() {
  if (!unstakeInput || Number(unstakeInput) <= 0) {
    setStatusMessage({
      type: "error",
      text: "Please enter a valid amount to unstake.",
    });
    return;
  }

  if (Number(unstakeInput) > Number(stakedBalance)) {
    setStatusMessage({
      type: "error",
      text: `Withdrawal exceeds staked balance. You currently have ${Number(
        stakedBalance
      ).toFixed(4)} ABC staked.`,
    });
    return;
  }

  try {
    setActionLoading("unstaking");
    setStatusMessage(null);

    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    const stakingContract = new Contract(
      STAKING_CONTRACT_ADDRESS,
      STAKING_CONTRACT_ABI,
      signer
    );

    const amountToUnstake = parseEther(unstakeInput);

    // Simulate first so genuine contract reverts are reported clearly.
    await stakingContract.unstake.staticCall(amountToUnstake);

    // Estimate gas, with a fallback for local Ganache.
    let gasLimit;

    try {
      const estimatedGas =
        await stakingContract.unstake.estimateGas(amountToUnstake);

      gasLimit = (estimatedGas * 120n) / 100n;
    } catch (estimateError) {
      console.warn(
        "Gas estimation failed; using local-network fallback:",
        estimateError
      );

      gasLimit = 300000n;
    }

    const tx = await stakingContract.unstake(amountToUnstake, {
      gasLimit,
    });

    setStatusMessage({
      type: "info",
      text: "Unstake transaction submitted. Awaiting confirmation...",
      hash: tx.hash,
    });

    const receipt = await tx.wait();

    if (!receipt || receipt.status !== 1) {
      throw new Error("The unstake transaction did not succeed.");
    }

    setStatusMessage({
      type: "success",
      text: `Successfully unstaked ${unstakeInput} ABC! Accrued rewards preserved.`,
      hash: tx.hash,
    });

    addTxHistory("UNSTAKE", `${unstakeInput} ABC`, tx.hash);

    setUnstakeInput("");
    await loadStakingData();
  } catch (err) {
    console.error("Unstake error:", err);

    if (err.code === 4001 || err.code === "ACTION_REJECTED") {
      setStatusMessage({
        type: "error",
        text: "Unstaking rejected in MetaMask.",
      });
    } else {
      setStatusMessage({
        type: "error",
        text:
          err.reason ||
          err.shortMessage ||
          err.info?.error?.message ||
          err.message ||
          "Unstaking failed.",
      });
    }
  } finally {
    setActionLoading("");
  }
}


  // Handle Claim Rewards
  async function handleClaimReward() {
    if (Number(pendingRewards) <= 0) {
      setStatusMessage({
        type: "error",
        text: "No rewards available to claim at this time.",
      });
      return;
    }

    if (Number(rewardPoolBalance) < Number(pendingRewards)) {
      setStatusMessage({
        type: "error",
        text: "Staking contract reward pool is currently low. Please contact admin to fund RWD tokens.",
      });
      return;
    }

    try {
      setActionLoading("claiming");
      setStatusMessage(null);

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const stakingContract = new Contract(
        STAKING_CONTRACT_ADDRESS,
        STAKING_CONTRACT_ABI,
        signer
      );

      const tx = await stakingContract.claimReward();

      setStatusMessage({
        type: "info",
        text: "Claim transaction submitted. Awaiting confirmation...",
        hash: tx.hash,
      });

      await tx.wait();

      setStatusMessage({
        type: "success",
        text: `Successfully claimed ${Number(pendingRewards).toFixed(4)} RWD reward tokens!`,
        hash: tx.hash,
      });

      addTxHistory("CLAIM", `${Number(pendingRewards).toFixed(4)} RWD`, tx.hash);
      await loadStakingData();
    } catch (err) {
      console.error("Claim error:", err);
      if (err.code === 4001) {
        setStatusMessage({ type: "error", text: "Claim rejected in MetaMask." });
      } else {
        setStatusMessage({
          type: "error",
          text: err.reason || err.message || "Claim rewards failed.",
        });
      }
    } finally {
      setActionLoading("");
    }
  }

  // Handle Exit (Withdraw All & Claim All)
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
      const stakingContract = new Contract(
        STAKING_CONTRACT_ADDRESS,
        STAKING_CONTRACT_ABI,
        signer
      );

     let gasLimit;

try {
  const estimatedGas = await stakingContract.exit.estimateGas();
  gasLimit = (estimatedGas * 120n) / 100n;
} catch (estimateError) {
  console.warn("Exit gas estimation failed:", estimateError);
  gasLimit = 300000n;
}

const tx = await stakingContract.exit({ gasLimit });

      setStatusMessage({
        type: "info",
        text: "Exit transaction submitted. Awaiting confirmation...",
        hash: tx.hash,
      });

      await tx.wait();

      setStatusMessage({
        type: "success",
        text: `Exit complete! Withdrew ${Number(
          stakedBalance
        ).toFixed(4)} ABC and claimed all pending RWD rewards.`,
        hash: tx.hash,
      });

      addTxHistory(
        "EXIT",
        `${Number(stakedBalance).toFixed(2)} ABC + ${Number(pendingRewards).toFixed(2)} RWD`,
        tx.hash
      );
      setStakeInput("");
      setUnstakeInput("");
      await loadStakingData();
    } catch (err) {
      console.error("Exit error:", err);
      if (err.code === 4001) {
        setStatusMessage({ type: "error", text: "Exit transaction rejected in MetaMask." });
      } else {
        setStatusMessage({
          type: "error",
          text: err.reason || err.message || "Exit transaction failed.",
        });
      }
    } finally {
      setActionLoading("");
    }
  }

  // Local Faucet Helper: Mint 100 ABC for local test networks
  async function handleMintTestTokens() {
    try {
      setActionLoading("faucet");
      setStatusMessage(null);

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const abcContract = new Contract(ABC_TOKEN_ADDRESS, ABC_TOKEN_ABI, signer);

      const tx = await abcContract.mint(account, parseEther("100"));
      setStatusMessage({
        type: "info",
        text: "Minting 100 test ABC tokens...",
        hash: tx.hash,
      });

      await tx.wait();

      setStatusMessage({
        type: "success",
        text: "Minted 100 test ABC tokens to your wallet!",
        hash: tx.hash,
      });

      addTxHistory("MINT_FAUCET", "100 ABC", tx.hash);
      await loadStakingData();
    } catch (err) {
      console.error("Mint error:", err);
      setStatusMessage({
        type: "error",
        text: err.reason || err.message || "Failed to mint test tokens.",
      });
    } finally {
      setActionLoading("");
    }
  }

  const needsApproval =
    Number(stakeInput) > 0 && Number(allowance) < Number(stakeInput);

  return (
    <div className="staking-panel-container">
      {/* Notice Banner */}
      <div className="staking-banner">
        <div>
          <span className="staking-badge">PART 2: PROTOCOL TOKEN STAKING</span>
          <h3>DeFi Staking & Reward Mechanism</h3>
          <p>
            Stake platform token (<strong>ABC</strong>) to earn time-based protocol rewards (
            <strong>RWD</strong>) at 0.001 RWD per ABC per second.
          </p>
        </div>
        <button
          className="faucet-btn"
          onClick={handleMintTestTokens}
          disabled={!!actionLoading}
          title="Mint 100 ABC tokens for testing simulation"
        >
          {actionLoading === "faucet" ? "Minting..." : "⚡ Faucet: Get 100 ABC"}
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
          <span className="stat-label">Available ABC</span>
          <strong className="stat-value">{Number(abcBalance).toFixed(4)}</strong>
          <span className="stat-sub">In your connected wallet</span>
        </div>

        <div className="staking-stat-card active-stake">
          <span className="stat-label">Staked ABC</span>
          <strong className="stat-value text-primary">{Number(stakedBalance).toFixed(4)}</strong>
          <span className="stat-sub">Currently earning rewards</span>
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
          <span className="stat-sub">Rate: 0.001 RWD / ABC / sec</span>
        </div>

        <div className="staking-stat-card">
          <span className="stat-label">Contract Pool</span>
          <strong className="stat-value">{Number(rewardPoolBalance).toFixed(2)}</strong>
          <span className="stat-sub">RWD available for payouts</span>
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
            Stake ABC
          </button>
          <button
            className={`staking-tab-btn ${activeTab === "unstake" ? "active" : ""}`}
            onClick={() => setActiveTab("unstake")}
          >
            Unstake ABC
          </button>
          <button
            className={`staking-tab-btn ${activeTab === "exit" ? "active" : ""}`}
            onClick={() => setActiveTab("exit")}
          >
            Exit & Settle All
          </button>
        </div>

        {/* Tab 1: Stake */}
        {activeTab === "stake" && (
          <div className="tab-pane">
            <div className="pane-header">
              <h4>Deposit & Stake ABC Tokens</h4>
              <p>Approve and transfer ABC tokens to the staking smart contract.</p>
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
                  onClick={() => setStakeInput(abcBalance)}
                >
                  MAX
                </button>
                <span className="unit">ABC</span>
              </div>
              <small className="input-hint">
                Balance: {Number(abcBalance).toFixed(4)} ABC | Approved: {Number(allowance).toFixed(4)} ABC
              </small>
            </div>

            <div className="actions-row">
              {needsApproval ? (
                <button
                  className="staking-action-btn primary"
                  onClick={handleApprove}
                  disabled={actionLoading === "approving" || !stakeInput}
                >
                  {actionLoading === "approving" ? "Approving in Wallet..." : "Step 1: Approve ABC"}
                </button>
              ) : (
                <button
                  className="staking-action-btn primary"
                  onClick={handleStake}
                  disabled={actionLoading === "staking" || !stakeInput || Number(stakeInput) <= 0}
                >
                  {actionLoading === "staking" ? "Staking in Progress..." : "Stake ABC"}
                </button>
              )}

              <button
                className="staking-action-btn secondary"
                onClick={handleClaimReward}
                disabled={actionLoading === "claiming" || Number(pendingRewards) <= 0}
              >
                {actionLoading === "claiming"
                  ? "Claiming..."
                  : `Claim Rewards (${Number(pendingRewards).toFixed(4)} RWD)`}
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Unstake */}
        {activeTab === "unstake" && (
          <div className="tab-pane">
            <div className="pane-header">
              <h4>Withdraw Staked ABC Tokens</h4>
              <p>Unstake a portion of your tokens. Pre-existing accrued rewards are safely preserved.</p>
            </div>

            <div className="input-group-wrapper">
              <label>Amount to Unstake</label>
              <div className="staking-input-row">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="0.0"
                  value={unstakeInput}
                  onChange={(e) => setUnstakeInput(e.target.value)}
                  disabled={!!actionLoading}
                />
                <button
                  type="button"
                  className="max-btn"
                  onClick={() => setUnstakeInput(stakedBalance)}
                >
                  MAX
                </button>
                <span className="unit">ABC</span>
              </div>
              <small className="input-hint">
                Currently Staked: {Number(stakedBalance).toFixed(4)} ABC
              </small>
            </div>

            <div className="actions-row">
              <button
                className="staking-action-btn primary"
                onClick={handleUnstake}
                disabled={
                  actionLoading === "unstaking" ||
                  !unstakeInput ||
                  Number(unstakeInput) <= 0 ||
                  Number(unstakeInput) > Number(stakedBalance)
                }
              >
                {actionLoading === "unstaking" ? "Unstaking..." : "Unstake ABC"}
              </button>

              <button
                className="staking-action-btn secondary"
                onClick={handleClaimReward}
                disabled={actionLoading === "claiming" || Number(pendingRewards) <= 0}
              >
                {actionLoading === "claiming"
                  ? "Claiming..."
                  : `Claim Rewards (${Number(pendingRewards).toFixed(4)} RWD)`}
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Exit */}
        {activeTab === "exit" && (
          <div className="tab-pane exit-pane">
            <div className="pane-header">
              <h4>Full Exit & Settlement</h4>
              <p>
                Withdraw all remaining staked ABC tokens and claim 100% of pending RWD rewards in a
                single transaction.
              </p>
            </div>

            <div className="exit-summary-box">
              <div className="exit-summary-row">
                <span>Staked ABC to Return:</span>
                <strong>{Number(stakedBalance).toFixed(4)} ABC</strong>
              </div>
              <div className="exit-summary-row">
                <span>Accrued RWD to Claim:</span>
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
                  ? "Exiting Protocol..."
                  : "Withdraw All & Claim All (Exit)"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transaction History */}
      {txHistory.length > 0 && (
        <div className="staking-history-box">
          <div className="history-header">
            <h4>Recent Staking Activity</h4>
            <button
              className="clear-history-btn"
              onClick={() => {
                setTxHistory([]);
                localStorage.removeItem(`staking_tx_${account}`);
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
