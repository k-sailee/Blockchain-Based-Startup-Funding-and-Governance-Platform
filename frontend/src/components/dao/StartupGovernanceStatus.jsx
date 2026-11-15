import { useEffect, useState } from "react";
import { getProposal, getProposalCount, getProposalState } from "../../services/daoService";

export default function StartupGovernanceStatus({ startupId }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const count = await getProposalCount();
        const proposals = await Promise.all(Array.from({ length: count }, async (_, id) => {
          const proposal = await getProposal(id);
          return Number(proposal.startupId) === Number(startupId)
            ? { id, title: proposal.title, state: await getProposalState(id) }
            : null;
        }));
        if (!cancelled) setItems(proposals.filter(Boolean));
      } catch { if (!cancelled) setItems([]); }
    }
    load();
    return () => { cancelled = true; };
  }, [startupId]);
  if (!items.length) return null;
  return <div className="startup-governance-status"><strong>Governance</strong>{items.map((item) => <span key={item.id}>#{item.id} {item.title}: {item.state === 0 ? "Voting in Progress" : item.state === 2 ? "Governance Approved" : "Governance Rejected"}</span>)}</div>;
}
