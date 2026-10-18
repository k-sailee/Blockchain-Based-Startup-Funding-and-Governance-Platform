
import { useEffect, useState } from "react";
import {
  BrowserProvider,
  Contract,
  formatUnits,
  parseUnits,
} from "ethers";
import { MOCK_TOKEN_ADDRESS, INVESTOR_VAULT_ADDRESS } from "../vaultConfig";
import mockTokenArtifact from "../../../artifacts/contracts/MockToken.sol/MockToken.json";
import vaultArtifact from "../../../artifacts/contracts/InvestorVault.sol/InvestorVault.json";

const tokenAbi = mockTokenArtifact.abi;
const vaultAbi = vaultArtifact.abi;

function formatTokenAmount(value) {
  return Number(formatUnits(value, 18)).toLocaleString(undefined, {
    maximumFractionDigits: 6,
  });
}

function getErrorMessage(error, fallback) {
  if (error?.code === 4001 || error?.code === "ACTION_REJECTED") {
    return "Transaction rejected in your wallet.";
  }

  return error?.shortMessage || error?.reason || error?.message || fallback;
}

export default function InvestorVaultPanel({ account }) {
  const [tokenBalance, setTokenBalance] = useState("0");
  const [shareBalance, setShareBalance] = useState("0");
  const [vaultAssets, setVaultAssets] = useState(0n);
  const [totalShares, setTotalShares] = useState(0n);
  const [representedAssets, setRepresentedAssets] = useState(0n);
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCalculation, setShowCalculation] = useState(false);

  async function getContracts() {
    if (!window.ethereum) {
      throw new Error("Please install or connect MetaMask.");
    }

    const provider = new BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();

    if (network.chainId !== 1337n) {
      throw new Error("Please switch MetaMask to Ganache (chain ID 1337).");
    }

    const signer = await provider.getSigner();
    const user = await signer.getAddress();

    if (account && user.toLowerCase() !== account.toLowerCase()) {
      throw new Error("Your wallet account changed. Refreshing the vault...");
    }

    const token = new Contract(MOCK_TOKEN_ADDRESS, tokenAbi, signer);
    const vault = new Contract(INVESTOR_VAULT_ADDRESS, vaultAbi, signer);

    return { user, token, vault };
  }

  async function refreshBalances() {
    try {
      const { user, token, vault } = await getContracts();

      const [tokens, shares, assets, sharesOutstanding, represented] =
        await Promise.all([
        token.balanceOf(user),
        vault.balanceOf(user),
        vault.totalAssets(),
        vault.totalSupply(),
        vault.convertToAssets(await vault.balanceOf(user)),
      ]);

      setTokenBalance(formatUnits(tokens, 18));
      setShareBalance(formatUnits(shares, 18));
      setVaultAssets(assets);
      setTotalShares(sharesOutstanding);
      setRepresentedAssets(represented);
      setStatus("");
    } catch (error) {
      setStatus(getErrorMessage(error, "Could not load balances."));
    }
  }

  useEffect(() => {
    if (account) {
      refreshBalances();
    }
  }, [account]);

  async function deposit() {
    if (!amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      setStatus("Enter a valid deposit amount.");
      return;
    }

    setBusy(true);
    setStatus("Approving test tokens...");

    try {
      const { token, vault } = await getContracts();
      const value = parseUnits(amount, 18);

      const balance = await token.balanceOf(account);
      if (balance < value) {
        throw new Error("Insufficient sfUSD balance for this deposit.");
      }

      const approval = await token.approve(INVESTOR_VAULT_ADDRESS, value);
      await approval.wait();

      setStatus("Depositing tokens...");
      const transaction = await vault.deposit(value, account);
      await transaction.wait();

      setStatus("Deposit successful! Vault shares received.");
      setAmount("");
      await refreshBalances();
    } catch (error) {
      setStatus(getErrorMessage(error, "Deposit failed."));
    } finally {
      setBusy(false);
    }
  }

  async function redeem() {
    if (!amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      setStatus("Enter a valid redemption amount.");
      return;
    }

    setBusy(true);
    setStatus("Redeeming vault shares...");

    try {
      const { user, vault } = await getContracts();
      const shares = parseUnits(amount, 18);
      const balance = await vault.balanceOf(user);
      if (balance < shares) {
        throw new Error("Insufficient sfVS share balance for this redemption.");
      }

      const transaction = await vault.redeem(shares, user, user);
      await transaction.wait();

      setStatus("Redemption successful! Test tokens returned.");
      setAmount("");
      await refreshBalances();
    } catch (error) {
      setStatus(getErrorMessage(error, "Redemption failed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="vault-panel">
      <h2>ERC-4626 Investor Vault</h2>
      <p>Deposit test tokens to receive vault shares, or redeem shares to get your tokens back.</p>

      <div className="vault-balances">
        <div>
          <span>Wallet sfUSD</span>
          <strong>{formatTokenAmount(parseUnits(tokenBalance, 18))}</strong>
        </div>
        <div>
          <span>Vault sfVS Shares</span>
          <strong>{formatTokenAmount(parseUnits(shareBalance, 18))}</strong>
        </div>
      </div>

      <p className="vault-account">
        Connected account: {account || "Not connected"}
      </p>
      <div className="vault-metrics">
        <span>Vault assets: {formatTokenAmount(vaultAssets)} sfUSD</span>
        <span>Outstanding shares: {formatTokenAmount(totalShares)} sfVS</span>
        <span>Represented value: {formatTokenAmount(representedAssets)} sfUSD</span>
      </div>

      <label htmlFor="vault-amount">Amount (sfUSD / sfVS)</label>
      <input
        id="vault-amount"
        type="number"
        min="0"
        step="any"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        placeholder="Enter amount"
      />

      <div className="vault-actions">
        <button onClick={deposit} disabled={busy}>
          {busy ? "Processing..." : "Approve & Deposit"}
        </button>
        <button onClick={redeem} disabled={busy}>
          {busy ? "Processing..." : "Redeem Shares"}
        </button>
        <button onClick={refreshBalances} disabled={busy}>
          Refresh Balances
        </button>
        <button
          onClick={() => setShowCalculation((visible) => !visible)}
          disabled={busy}
        >
          {showCalculation ? "Hide Profit Calculation" : "Show Profit Calculation"}
        </button>
      </div>

      {status && <p role="status">{status}</p>}

      {showCalculation && (
        <div className="vault-calculation">
          <h3>Share-value calculation</h3>
          <p>
            These values are read from the connected vault on this page. The
            basic formula is total vault assets divided by outstanding shares.
          </p>
          <dl>
            <div>
              <dt>Current assets</dt>
              <dd>{formatTokenAmount(vaultAssets)} sfUSD</dd>
            </div>
            <div>
              <dt>Current shares</dt>
              <dd>{formatTokenAmount(totalShares)} sfVS</dd>
            </div>
            <div>
              <dt>Your shares</dt>
              <dd>{formatTokenAmount(parseUnits(shareBalance, 18))} sfVS</dd>
            </div>
            <div>
              <dt>Your represented value</dt>
              <dd>{formatTokenAmount(representedAssets)} sfUSD</dd>
            </div>
          </dl>
          <p className="vault-formula">
            Share value = {formatTokenAmount(vaultAssets)} /{" "}
            {formatTokenAmount(totalShares)} sfUSD per sfVS
          </p>
          <p>
            No historical before-profit snapshot is stored by this basic vault,
            so the UI does not invent a before/after gain. Deposits and
            redemptions also change the totals and must not be mislabeled as
            startup profit.
          </p>
          <div className="vault-example">
            <strong>Illustrative example, not your balance:</strong>
            <span>
              1,200 sfUSD / 1,000 sfVS = 1.2 sfUSD per share. An investor with
              500 shares would represent 600 sfUSD, compared with 500 sfUSD
              before a genuine 200 sfUSD return.
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
