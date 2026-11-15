import { useOracleData } from "../oracle/useOracleData";

export default function OracleStatus({ account, compact = false }) {
  const { oracle, network, loading, error, refresh } = useOracleData(account);

  if (!account) {
    return <div className="oracle-status oracle-muted">Connect a wallet to view live oracle data.</div>;
  }
  if (loading && !oracle) {
    return <div className="oracle-status">Loading oracle data…</div>;
  }
  if (error) {
    return (
      <div className="oracle-status oracle-error">
        <span>{error}</span>
        <button onClick={refresh}>Retry</button>
      </div>
    );
  }
  if (!oracle || !network) return null;

  return (
    <section className={`oracle-status ${oracle.fresh ? "oracle-fresh" : "oracle-stale"}`}>
      <div>
        <strong>{network.name} · ETH/USD ${oracle.priceFormatted}</strong>
        <span>{oracle.fresh ? `Fresh · ${oracle.age}s old` : `Stale · ${oracle.age}s old`}</span>
      </div>
      {!compact && (
        <div className="oracle-status-details">
          <span>Reader: {network.readerAddress}</span>
          <span>Feed: {network.feedType}</span>
          <span>Decimals: {oracle.decimals} · Updated: {oracle.updatedLabel}</span>
        </div>
      )}
    </section>
  );
}
