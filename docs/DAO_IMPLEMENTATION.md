# DAO implementation guide

## Aim and theory

This module demonstrates delegated, token-weighted governance for StartFund. CDT balances do not count as voting power until delegated. Historical checkpoints keep transfers after proposal creation from rewriting vote weight.

## Contracts

- `GovernanceToken`: Class DAO Token (`CDT`), 1,000 tokens, 18 decimals, fixed supply, ERC20Permit and ERC20Votes.
- `DAOVoting`: 50 CDT proposal threshold, five-block voting period, 4% quorum with 40 CDT minimum, and strict For > Against majority.
- `propose(description)` creates an academic proposal.
- `proposeFunding(startupId, fundingAmount, title, description)` links a request to an existing startup ID; amount is wei.
- `castVote(proposalId, support)` uses `true` for For and `false` for Against.

## Distribution and eligibility

Academic allocations: Alice 400, Bob 250, Carol 200, Dave 100, Eve 50 CDT; Frank and Grace receive zero. There is no public mint. The deployment script transfers from the deployer's initial allocation. It self-delegates only when a recipient signer is available; otherwise the recipient delegates from their own wallet. Real StartFund allocations require explicit administrator transfers. ETH investment does not grant CDT automatically.

## Voting rules

Snapshot is the block before proposal creation is mined. Votes are accepted in later blocks through the end block. At close, quorum is `max(40 CDT, snapshot total supply × 4 / 100)`; success also requires For > Against. State values are 0 Active, 1 Defeated, 2 Succeeded. DAO approval records status only and never transfers ETH.

## Limitations

This academic/MVP system is not audited. It has no timelock, cancellation, on-chain funding execution, indexed backend, token sale, investor-to-token policy, or guarantee that founder metadata stays available. The proposal retains its numeric startup ID if the UI cannot load details.
