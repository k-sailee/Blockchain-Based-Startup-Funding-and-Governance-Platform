import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserProvider, formatUnits } from "ethers";
import { readOracle } from "./oracleClient";
import { getSelectedProvider, subscribeWallets } from "../walletManager";

export function useOracleData(account) {
  const [oracle, setOracle] = useState(null);
  const [network, setNetwork] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current;
    const selectedProvider = getSelectedProvider();
    if (!getSelectedProvider() || !account) {
      if (currentRequest !== requestId.current) return;
      setOracle(null);
      setNetwork(null);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const provider = new BrowserProvider(selectedProvider);
      const chainId = Number((await provider.getNetwork()).chainId);
      const result = await readOracle(provider, chainId);
      if (currentRequest !== requestId.current || selectedProvider !== getSelectedProvider()) return;
      setNetwork(result);
      setOracle(result);
    } catch (readError) {
      if (currentRequest !== requestId.current) return;
      setOracle(null);
      setError(readError?.shortMessage || readError?.reason || readError?.message || "Oracle unavailable.");
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    refresh();
    const unsubscribe = subscribeWallets(() => refresh());
    const injectedProvider = getSelectedProvider();
    if (!injectedProvider) return unsubscribe;
    const handleChainChanged = () => refresh();
    injectedProvider.on("chainChanged", handleChainChanged);
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      unsubscribe();
      injectedProvider.removeListener("chainChanged", handleChainChanged);
      window.clearInterval(timer);
    };
  }, [refresh]);

  return { oracle, network, loading, error, refresh };
}

export function formatUsdEstimate(weiAmount, oracle) {
  if (!oracle || weiAmount === undefined) return null;
  const usd = (weiAmount * oracle.price) / 10n ** BigInt(oracle.decimals);
  return formatUnits(usd, 18);
}
