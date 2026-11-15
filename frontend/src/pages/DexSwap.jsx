import { useCallback, useEffect, useState } from "react";
import { BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";
import { DEX_CONFIG } from "../dexConfig";
import OracleStatus from "../components/OracleStatus";
import { getSelectedProvider } from "../walletManager";

const ABI = [
  "function approve(address,uint256) returns(bool)",
  "function balanceOf(address) view returns(uint256)",
  "function getAmountOut(uint256,address) view returns(uint256)",
  "function swapExactTokensForTokens(address,uint256,uint256,address) returns(uint256)",
  "event Swap(address indexed trader,address indexed tokenIn,uint256 amountIn,uint256 amountOut,address indexed to)",
];
const TOKENS = {
  WETH: { address: DEX_CONFIG.WETH9, decimals: 18 },
  USDC: { address: DEX_CONFIG.MockUSDC, decimals: 6 },
};
const message = (error) =>
  error?.shortMessage || error?.reason || error?.message || "Transaction failed";

export default function DexSwap({ account, onBack }) {
  const [direction, setDirection] = useState("WETH");
  const [amount, setAmount] = useState("1");
  const [slippage, setSlippage] = useState("0.5");
  const [quote, setQuote] = useState("");
  const [balances, setBalances] = useState({ WETH: "—", USDC: "—" });
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = TOKENS[direction];
  const output = TOKENS[direction === "WETH" ? "USDC" : "WETH"];

  const refresh = useCallback(async () => {
    try {
      if (!getSelectedProvider() || !account || !DEX_CONFIG.AMMPool) return;
      const provider = new BrowserProvider(getSelectedProvider());
      const pool = new Contract(DEX_CONFIG.AMMPool, ABI, provider);
      const [weth, usdc, logs] = await Promise.all([
        new Contract(TOKENS.WETH.address, ABI, provider).balanceOf(account),
        new Contract(TOKENS.USDC.address, ABI, provider).balanceOf(account),
        pool.queryFilter(pool.filters.Swap(), -100),
      ]);
      setBalances({ WETH: formatUnits(weth, 18), USDC: formatUnits(usdc, 6) });
      setEvents(logs.slice(-5).reverse());
    } catch (caught) {
      setError(message(caught));
    }
  }, [account]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function quoteSwap() {
    try {
      setError("");
      const provider = new BrowserProvider(getSelectedProvider());
      if (Number((await provider.getNetwork()).chainId) !== 1337) {
        throw Error("Switch wallet to local Ganache (chain 1337).");
      }
      const result = await new Contract(DEX_CONFIG.AMMPool, ABI, provider).getAmountOut(
        parseUnits(amount, input.decimals),
        input.address,
      );
      setQuote(formatUnits(result, output.decimals));
    } catch (caught) {
      setError(message(caught));
    }
  }

  async function swap() {
    setBusy(true);
    setStatus("");
    setError("");
    try {
      const signer = await new BrowserProvider(getSelectedProvider()).getSigner();
      const token = new Contract(input.address, ABI, signer);
      const pool = new Contract(DEX_CONFIG.AMMPool, ABI, signer);
      const rawAmount = parseUnits(amount, input.decimals);
      if ((await token.balanceOf(account)) < rawAmount) {
        throw Error(`Insufficient ${direction} balance.`);
      }
      const outputAmount = await pool.getAmountOut(rawAmount, input.address);
      const minimumOutput =
        (outputAmount * BigInt(Math.round((100 - Number(slippage)) * 100))) / 10000n;
      setStatus("Approving…");
      await (await token.approve(DEX_CONFIG.AMMPool, rawAmount)).wait();
      setStatus("Swap pending…");
      await (await pool.swapExactTokensForTokens(input.address, rawAmount, minimumOutput, account)).wait();
      setStatus("Swap successful.");
      await refresh();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="lab">
      <button onClick={onBack}>← Back</button>
      <h1>DEX Swap</h1>
      <p>Local Ganache · 0.30% fee</p>
      <OracleStatus account={account} compact />
      <p>Chainlink is a reference only; swap quotes remain AMM reserve-based.</p>
      <div className="lab-grid">
        <p>WETH: {balances.WETH}</p>
        <p>USDC: {balances.USDC}</p>
      </div>
      <select value={direction} onChange={(event) => { setDirection(event.target.value); setQuote(""); }}>
        <option>WETH</option>
        <option>USDC</option>
      </select>
      <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={`Amount ${direction}`} />
      <label>Slippage <select value={slippage} onChange={(event) => setSlippage(event.target.value)}>
        <option>0.5</option><option>1</option><option>2</option>
      </select>%</label>
      <div className="dex-actions">
        <button onClick={quoteSwap} disabled={busy}>Quote</button>
        <button onClick={swap} disabled={busy}>Swap {direction} → {direction === "WETH" ? "USDC" : "WETH"}</button>
      </div>
      {quote && <p>Estimated output: <b>{quote} {direction === "WETH" ? "USDC" : "WETH"}</b></p>}
      {status && <p className="status">{status}</p>}
      {error && <p className="error">{error}</p>}
      <button onClick={refresh}>Refresh</button>
      <h3>Recent Swap events</h3>
      {events.length ? events.map((event, index) => (
        <p className="history" key={index}>{event.args.amountIn.toString()} in → {event.args.amountOut.toString()} out</p>
      )) : <p>No recent swaps.</p>}
    </section>
  );
}
