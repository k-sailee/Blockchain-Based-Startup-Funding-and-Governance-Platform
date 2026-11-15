import { useCallback, useEffect, useState } from "react";
import StartupFunding from "../contracts/StartupFunding.json";
import { BrowserProvider, Contract, formatUnits, isAddress, parseUnits } from "ethers";
import { getSelectedProvider } from "../walletManager";
import { CONTRACT_ABI, CONTRACT_ADDRESS } from "../contractConfig";
import {
  castVote, createFundingProposal, createProposal, delegateVotes,
  getDelegate, getHistoricalVotingPower, getProposal, getProposalCount, getProposalState,
  getProposalVotes, getQuorum, getTokenBalance, getVotingPower, hasVoted,
} from "../services/daoService";
import "../index.css";

const states = ["Active", "Defeated", "Succeeded"];
const token = (v) => `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })} CDT`;

export default function DAOGovernance({ account, onBack, onConnect }) {
  const [stats, setStats] = useState({ balance: "0", votes: "0", delegate: "", quorum: "40", count: 0 });
  const [proposals, setProposals] = useState([]);
  const [startups, setStartups] = useState([]);
  const [delegation, setDelegation] = useState("");
  const [form, setForm] = useState({ kind: "academic", title: "", description: "", startupId: "", amount: "" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!account || !getSelectedProvider()) { setProposals([]); return; }
    const [balance, votes, currentDelegate, quorum, count] = await Promise.all([
      getTokenBalance(account), getVotingPower(account), getDelegate(account), getQuorum(), getProposalCount(),
    ]);
    const items = await Promise.all(Array.from({ length: count }, async (_, id) => {
      const [proposal, voteTotals, state, voted] = await Promise.all([
        getProposal(id), getProposalVotes(id), getProposalState(id), hasVoted(id, account),
      ]);
      let historical = "0";
      try { historical = await getHistoricalVotingPower(account, proposal.snapshotBlock); } catch { /* snapshot may not be queryable yet */ }
      return { id, proposal, ...voteTotals, state, voted, historical };
    }));
    setStats({ balance, votes, delegate: currentDelegate, quorum, count, participation: count ? Math.round(items.filter((p) => p.voted).length * 100 / count) : 0 });
    setProposals(items.reverse());
    try {
      const provider = new BrowserProvider(getSelectedProvider());
      const funding = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI || StartupFunding.abi, provider);
      const startupCount = Number(await funding.startupCount());
      const records = await Promise.all(Array.from({ length: startupCount }, async (_, index) => {
        const row = await funding.getStartup(index + 1);
        return { id: Number(row[0]), name: row[2] };
      }));
      setStartups(records);
    } catch { setStartups([]); }
  }, [account]);

  useEffect(() => {
    const timer = window.setTimeout(() => refresh().catch((e) => setMessage(e.message)), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  async function transact(action, success) {
    setBusy(true); setMessage("");
    try { const result = await action(); setMessage(`${success} Transaction: ${result.hash}`); await refresh(); }
    catch (error) { setMessage(error.message || "DAO transaction failed."); }
    finally { setBusy(false); }
  }

  async function submit(e) {
    e.preventDefault();
    if (form.kind === "academic") {
      await transact(() => createProposal(form.title.trim() ? `${form.title.trim()}\n\n${form.description}` : form.description), "Proposal submitted.");
    } else {
      await transact(() => createFundingProposal(form.startupId, form.amount, form.title, form.description), "Funding proposal submitted for governance.");
    }
  }

  async function vote(id, support) {
    await transact(() => castVote(id, support), "Vote confirmed.");
  }

  async function delegate() {
    const target = delegation.trim() || account;
    if (!isAddress(target)) { setMessage("Enter a valid delegate address."); return; }
    await transact(() => delegateVotes(target), "Delegation updated.");
  }

  return <main className="dao-page">
    <header className="dao-header"><button onClick={onBack}>← StartFund</button><div><span className="badge">STARTFUND GOVERNANCE</span><h1>DAO Governance</h1><p>Token holders create proposals, delegate voting power, and decide funding requests.</p></div>
      {!account && <button className="connect-btn" onClick={onConnect}>Connect wallet</button>}</header>
    <section className="dao-stats">
      <article><small>Proposals</small><strong>{stats.count}</strong></article><article><small>Active</small><strong>{proposals.filter((p) => p.state === 0).length}</strong></article>
      <article><small>Succeeded</small><strong>{proposals.filter((p) => p.state === 2).length}</strong></article><article><small>Defeated</small><strong>{proposals.filter((p) => p.state === 1).length}</strong></article>
      <article><small>CDT balance</small><strong>{token(stats.balance)}</strong></article><article><small>Voting power</small><strong>{token(stats.votes)}</strong></article>
      <article><small>Delegate</small><strong>{stats.delegate ? `${stats.delegate.slice(0, 6)}…${stats.delegate.slice(-4)}` : "None"}</strong></article><article><small>Your participation</small><strong>{stats.participation || 0}%</strong></article>
    </section>
    <section className="dao-columns">
      <div className="dao-panel"><h2>Delegate voting power</h2><p>Delegation changes who can vote with your CDT. It does not transfer token ownership.</p><div className="dao-inline"><input aria-label="Delegate address" value={delegation} onChange={(e) => setDelegation(e.target.value)} placeholder="Address (blank to self-delegate)"/><button disabled={!account || busy} onClick={delegate}>Delegate</button></div></div>
      <form className="dao-panel" onSubmit={submit}><h2>Create a proposal</h2><label>Proposal type<select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}><option value="academic">Academic proposal</option><option value="funding">Startup funding request</option></select></label>
        {form.kind === "funding" && <><label>Startup<select required value={form.startupId} onChange={(e) => setForm({ ...form, startupId: e.target.value })}><option value="">Select startup</option>{startups.map((s) => <option key={s.id} value={s.id}>#{s.id} {s.name}</option>)}</select></label><label>Funding amount (ETH)<input required min="0" type="number" step="any" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}/></label></>}
        <label>Title<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}/></label><label>Description and reason<textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}/></label>
        <button disabled={!account || busy}>Submit on-chain</button></form>
    </section>
    {message && <p className="dao-message" role="status">{message}</p>}
    <section className="dao-list"><div className="dao-list-heading"><div><span className="badge">ON-CHAIN RECORDS</span><h2>Proposals</h2></div><button onClick={() => refresh().catch((e) => setMessage(e.message))}>Refresh</button></div>
      {proposals.length === 0 && <p>No proposals found on this network.</p>}
      {proposals.map(({ id, proposal: p, against, for: forVotes, state, voted, historical }) => {
        const total = forVotes + against; const quorumUnits = parseUnits(stats.quorum || "40", 18); const quorumProgress = total * 10000n / (quorumUnits || 1n);
        const deadline = Number(p.endBlock);
        return <article className="dao-proposal" key={id}><div className="dao-proposal-top"><div><small>Proposal #{id} · {p.category}</small><h3>{p.title}</h3></div><span className={`dao-state state-${state}`}>{states[state]}</span></div>
          <p>{p.description}</p>{p.startupId > 0n && <p><b>{startups.find((startup) => startup.id === Number(p.startupId))?.name || `Startup #${p.startupId}`}</b> · Requested {formatUnits(p.fundingAmount, 18)} ETH</p>}
          <small>Proposed by {p.proposer} · Snapshot block {p.snapshotBlock} · Ends at block {deadline}</small>
          <div className="dao-votes"><span>For: {token(formatUnits(forVotes, 18))}</span><span>Against: {token(formatUnits(against, 18))}</span></div>
          <div className="dao-progress"><i style={{ width: `${Math.min(100, Number(quorumProgress) / 100)}%` }}/></div><small>Quorum: {token(formatUnits(total, 18))} / {token(stats.quorum)} · Your snapshot weight: {token(historical)}</small>
          {state === 0 && <div className="dao-inline"><button disabled={!account || voted || Number(historical) <= 0 || busy} onClick={() => vote(id, true)}>Vote For</button><button className="secondary" disabled={!account || voted || Number(historical) <= 0 || busy} onClick={() => vote(id, false)}>Vote Against</button>{voted && <small>You voted</small>}</div>}
        </article>;
      })}
    </section>
  </main>;
}
