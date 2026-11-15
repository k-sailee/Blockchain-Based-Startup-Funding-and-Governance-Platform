# DAO test report

| Case | Scenario | Expected result |
|---|---|---|
| T1 | Alice For, Bob Against, Carol For | 600 For, 250 Against, state 2 |
| T2 | Alice and Bob Against, Carol For | 200 For, 650 Against, state 1 |
| T3 | Eve alone votes For with 50 CDT | 40 CDT minimum quorum; state 2 |
| T4 | No votes | Quorum missed; state 1 |
| T5 | Alice votes twice | Second vote reverts |
| T6 | Alice transfers after snapshot; Frank delegates later | Frank has zero historical power; reverts |
| T7 | Advance six blocks | Vote reverts as closed |
| T8 | Eve sends tokens to non-delegating Grace | Grace has zero voting power; reverts |
| T9 | Grace has no delegated votes | Proposal creation reverts below threshold |

## Results

`npx hardhat test mocha`: **58 passing**, including all nine DAO cases and existing Mocha suites. `npx hardhat build`: passed with solc 0.8.28. Frontend `npm run build`: passed; Vite emitted a large-chunk advisory. The DAO was deployed to local Ganache (addresses in `DAO_DEPLOYMENT.md`); browser wallet interaction was not manually exercised.

`npx tsc --noEmit`: passed. Frontend `npm run lint`: passed with existing React effect/dependency warnings in legacy dashboard, staking, DEX and oracle files; the new DAO files report no lint warnings.

Unit tests verify threshold, snapshot power, double-vote prevention, deadline, quorum and majority. Frontend build verifies compilation only; live wallet interactions require configured addresses and were not simulated.
