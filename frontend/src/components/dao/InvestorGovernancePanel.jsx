import { useCallback, useEffect, useState } from "react";
import {
  castVote, delegateVotes, getDelegate, getHistoricalVotingPower, getProposal,
  getProposalCount, getProposalState, getTokenBalance, getVotingPower, getVotingHistory, hasVoted,
} from "../../services/daoService";

export default function InvestorGovernancePanel({ account, onOpenDAO }) {
  const [data, setData] = useState({ balance: "0", power: "0", delegate: "", active: [], history: [] });
  const [target, setTarget] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!account) return;
    try {
      const [balance, power, currentDelegate, count] = await Promise.all([
        getTokenBalance(account), getVotingPower(account), getDelegate(account), getProposalCount(),
      ]);
      const records = await Promise.all(Array.from({ length: count }, async (_, id) => {
        const [proposal, state, voted] = await Promise.all([getProposal(id), getProposalState(id), hasVoted(id, account)]);
        const snapshotPower = Number(await getHistoricalVotingPower(account, proposal.snapshotBlock));
        return { id, title: proposal.title, state, voted, snapshotPower };
      }));
      const history = await getVotingHistory(account);
      const voteByProposal = new Map(history.map((vote) => [vote.proposalId, vote]));
      setData({ balance, power, delegate: currentDelegate, active: records.filter((p) => p.state === 0 && !p.voted && p.snapshotPower > 0), history: records.filter((p) => p.voted).map((p) => ({ ...p, vote: voteByProposal.get(p.id) })) });
    } catch { setData({ balance: "0", power: "0", delegate: "", active: [], history: [] }); }
  }, [account]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function run(action, label) {
    setBusy(true); setMessage("");
    try { const result = await action(); setMessage(`${label} · ${result.hash}`); await load(); }
    catch (error) { setMessage(error.message || "Governance transaction failed."); }
    finally { setBusy(false); }
  }

  return <section className="investor-governance-panel">
    <div><span className="dashboard-badge">GOVERNANCE</span><h2>Your CDT and votes</h2>
      <p>Balance: <b>{data.balance} CDT</b> · Current voting power: <b>{data.power} CDT</b></p>
      <p>Delegate: <b>{data.delegate || "None"}</b></p>
      <div className="dao-inline"><input aria-label="Delegate address" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Delegate address (blank = self)"/><button disabled={busy} onClick={() => run(() => delegateVotes(target || account), "Delegation updated")}>Delegate</button><button className="secondary" onClick={onOpenDAO}>Open DAO</button></div>
    </div>
    <div><h3>Available votes ({data.active.length})</h3>{data.active.slice(0, 4).map((p) => <div className="investor-governance-row" key={p.id}><span>#{p.id} {p.title}</span><button disabled={busy} onClick={() => run(() => castVote(p.id, true), "Voted For")}>For</button><button className="secondary" disabled={busy} onClick={() => run(() => castVote(p.id, false), "Voted Against")}>Against</button></div>)}{data.active.length === 0 && <small>No active proposals with snapshot voting power.</small>}</div>
    <div><h3>Previous votes</h3>{data.history.length ? data.history.slice(-4).reverse().map((p) => <p key={p.id}>Proposal #{p.id}: {p.vote?.support ? "For" : "Against"} ({p.vote?.weight || "0"} CDT)</p>) : <small>No votes recorded for this account.</small>}{message && <small className="governance-tx-message">{message}</small>}</div>
  </section>;
}
