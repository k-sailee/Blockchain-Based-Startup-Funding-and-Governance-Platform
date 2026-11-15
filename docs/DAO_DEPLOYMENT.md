# DAO deployment

The script uses the selected Hardhat network (`HARDHAT_NETWORK`, default `ganache`), deploys token and voting contracts, distributes academic balances, and writes `deployments/dao-<network>.json`. It writes generated ABIs to `frontend/src/contracts/` without changing existing deployment files.

## Ganache deployment performed

The DAO was deployed to the already-running local Ganache instance (chain ID 1337) at block 56:

- GovernanceToken: `0xC3FE1944Ecdf96834f03295fdba79200e5174856`
- DAOVoting: `0x57b00957130BCc4b9Df4eFd4834e2Eb568D6A62E`
- Deployment manifest: `deployments/dao-ganache.json`

The local frontend configuration is in the ignored `frontend/.env.local`. It contains only these public local contract addresses and chain ID; copy the values from the manifest when using a different chain.

Alice through Eve received their listed allocations and self-delegated. The first two deployment attempts left unused token contracts at `0x070a8be26dfaba95bffa0edca07419a9d2e2ec76` and `0x6725b422625a4e1bbf564d638625c7a81c30cd68`; the temporary Alice allocations on those contracts were returned to the deployer. Ganache was not reset. Only the block 56 addresses above are used by the frontend.

For Ganache, start chain ID 1337 at `http://127.0.0.1:7545`, configure the deployer key through the existing `GANACHE_PRIVATE_KEY`, and set seven participant addresses in `DAO_EXPERIMENT_ADDRESSES` (comma-separated). The first five receive 400/250/200/100/50 CDT; Frank and Grace are listed with zero allocation. External recipients self-delegate from their wallets.

```powershell
$env:HARDHAT_NETWORK="ganache"
$env:DAO_EXPERIMENT_ADDRESSES="0xAlice,0xBob,0xCarol,0xDave,0xEve,0xFrank,0xGrace"
npx hardhat run scripts/deployDAO.ts --network ganache
```

Set `VITE_DAO_TOKEN_ADDRESS`, `VITE_DAO_VOTING_ADDRESS`, and `VITE_DAO_CHAIN_ID=1337` in `frontend/.env.local` from the generated manifest, then restart Vite. Sepolia requires its own manifest and addresses. Only record addresses or transaction hashes after actual deployment.
