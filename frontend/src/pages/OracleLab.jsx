import { useCallback, useEffect, useState } from "react";
import { BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";
import { DEX_CONFIG } from "../dexConfig";
import { getNetworkConfig, readOracle } from "../oracle/oracleClient";
import { getSelectedProvider } from "../walletManager";

const feedAbi = [
  "function owner() view returns(address)",
  "function setPrice(int256)",
];
const poolAbi = [
  "function reserves() view returns(uint112,uint112)",
];
const message = (error) => error?.shortMessage || error?.reason || error?.message || "Oracle read failed";

export default function OracleLab({ onBack }) {
  const [network, setNetwork] = useState(null);
  const [data, setData] = useState(null);
  const [ethInput, setEthInput] = useState("0.5");
  const [usdValue, setUsdValue] = useState("");
  const [conversionLoading, setConversionLoading] = useState(false);
  const [conversionError, setConversionError] = useState("");
  const [localPrice, setLocalPrice] = useState("2500");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const calculateConversion = useCallback((oracleData) => {
    setConversionLoading(true);
    setConversionError("");
    setUsdValue("");
    try {
      if (!oracleData || !oracleData.fresh) {
        throw new Error("Cannot calculate conversion from stale or invalid oracle data.");
      }
      const amount = parseUnits(ethInput || "0", 18);
      const usd = (amount * oracleData.priceRaw) / 10n ** BigInt(oracleData.decimals);
      setUsdValue(formatUnits(usd, 18));
    } catch (conversionErrorValue) {
      setConversionError(message(conversionErrorValue));
    } finally {
      setConversionLoading(false);
    }
  }, [ethInput]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setConversionLoading(true);
    setUsdValue("");
    setConversionError("");
    setError("");
    try {
      if (!getSelectedProvider()) throw new Error("Install or select a browser wallet to inspect the oracle.");
      const provider = new BrowserProvider(getSelectedProvider());
      const chainId = Number((await provider.getNetwork()).chainId);
      const selected = getNetworkConfig(chainId);
      setNetwork(selected);
      if (!selected) {
        setData(null);
        throw new Error(`Unsupported network (chain ${chainId}). Switch to Ganache or Sepolia.`);
      }
      if (!selected.readerAddress) {
        setData(null);
        throw new Error(`${selected.name} reader address is not configured yet.`);
      }
      const result = await readOracle(provider, chainId);
      let ammPrice = "";
      if (chainId === 1337 && DEX_CONFIG.AMMPool) {
        const [reserveEth, reserveUsdc] = await new Contract(DEX_CONFIG.AMMPool, poolAbi, provider).reserves();
        if (reserveEth > 0n) ammPrice = formatUnits((reserveUsdc * 10n ** 18n) / reserveEth, 6);
      }
      setData({
        priceRaw: result.price,
        price: result.priceFormatted,
        decimals: result.decimals,
        updatedAt: result.updatedLabel,
        age: result.age,
        fresh: result.fresh,
        description: result.description,
        feedAddress: selected.feedAddress,
        ammPrice,
      });
      calculateConversion({
        priceRaw: result.price,
        decimals: result.decimals,
        fresh: result.fresh,
      });
    } catch (readError) {
      setUsdValue("");
      setConversionError("Conversion unavailable until a fresh oracle reading is available.");
      setError(message(readError));
    } finally {
      setLoading(false);
      setConversionLoading(false);
    }
  }, [calculateConversion]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (data) calculateConversion(data);
  }, [data, calculateConversion]);

  async function updateLocalPrice() {
    setStatus("");
    setError("");
    try {
      if (!network || network.chainId !== 1337) throw new Error("Mock price updates are available only on Ganache.");
      const signer = await new BrowserProvider(getSelectedProvider()).getSigner();
      const oracle = new Contract(DEX_CONFIG.MockETHUSDOracle, feedAbi, signer);
      if ((await signer.getAddress()).toLowerCase() !== (await oracle.owner()).toLowerCase()) {
        throw new Error("Only the local mock oracle owner can update the price.");
      }
      await (await oracle.setPrice(parseUnits(localPrice, 8))).wait();
      setStatus("Local mock price updated.");
      await refresh();
    } catch (updateError) {
      setError(message(updateError));
    }
  }

  return (
    <section className="lab oracle-dashboard">
      <button onClick={onBack}>← Back</button>
      <h1>Chainlink Oracle Dashboard</h1>
      <p>Oracle valuation is informational. Funding and AMM execution remain ETH- and reserve-based.</p>
      {loading && <p className="status">Loading oracle data…</p>}
      {network && (
        <div className="lab-grid">
          <div>
            <p><b>Network</b><br />{network.name} (chain {network.chainId})</p>
            <p><b>Source</b><br />{network.feedType}</p>
            <p><b>Feed</b><br />{network.feedAddress || "Not configured"}</p>
          </div>
          <div>
            <p><b>Availability</b><br />{network.readerAddress ? "Configured" : "Unavailable"}</p>
            {data && <p><b>Freshness</b><br />{data.fresh ? `Fresh (${data.age}s old)` : `Stale (${data.age}s old)`}</p>}
          </div>
        </div>
      )}
      {data && (
        <div className="lab-grid">
          <div>
            <p><b>ETH/USD</b><br />${data.price}</p>
            <p><b>Feed decimals</b><br />{data.decimals}</p>
            <p><b>Description</b><br />{data.description}</p>
          </div>
          <div>
            <p><b>Last updated</b><br />{data.updatedAt}</p>
            <p><b>AMM reference</b><br />{data.ammPrice ? `${data.ammPrice} USDC/WETH` : "Unavailable"}</p>
            <p>AMM pricing is reserve-based and is not replaced by Chainlink.</p>
          </div>
        </div>
      )}
      <h3>ETH to USD converter</h3>
      <input value={ethInput} onChange={(event) => setEthInput(event.target.value)} placeholder="ETH amount" />
      <button onClick={() => calculateConversion(data)} disabled={conversionLoading || loading}>
        {conversionLoading ? "Converting…" : "Convert"}
      </button>
      {conversionLoading && <p className="status">Refreshing conversion from the latest oracle reading…</p>}
      {usdValue && !conversionError && <p><b>{ethInput} ETH ≈ ${usdValue}</b> at the current reference price.</p>}
      {conversionError && <p className="error">{conversionError}</p>}
      {network?.chainId === 1337 && (
        <>
          <h3>Ganache mock feed</h3>
          <input value={localPrice} onChange={(event) => setLocalPrice(event.target.value)} placeholder="ETH/USD" />
          <button onClick={updateLocalPrice}>Update local price (owner only)</button>
        </>
      )}
      <button onClick={refresh}>Refresh</button>
      {status && <p className="status">{status}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
