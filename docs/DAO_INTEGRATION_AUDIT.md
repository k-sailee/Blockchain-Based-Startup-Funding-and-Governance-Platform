# StartFund DAO integration audit

## Audit scope and findings

The repository is an existing React 19 + Vite application with Solidity contracts and Hardhat 3. It includes startup creation and direct ETH investment, staking/rewards, a yield farm, vault, AMM/DEX and oracle modules. This implementation is additive; `StartupFunding.sol` and the existing wallet system were left unchanged.

| Area | Existing implementation | DAO integration decision |
|---|---|---|
| Hardhat | Hardhat 3.13.0; Mocha + ethers toolbox 3.0.7 | Use `network.create()` in TypeScript tests and scripts |
| Solidity | 0.8.28, Paris EVM | Use existing settings |
| OpenZeppelin | `@openzeppelin/contracts` 5.2.0 | Use ERC20, ERC20Permit and ERC20Votes v5 overrides |
| Ethers | 6.17.0 in root and frontend | Use BrowserProvider and bigint-safe units |
| Frontend | React 19, Vite 8, custom page state in `App.jsx` | Add a DAO page to current page selection |
| Wallet | `walletManager.js` owns injected wallet; AppKit handles WalletConnect | DAO reuses selected provider |
| Funding records | `StartupFunding` has numeric IDs | Funding proposals store this ID; no funding contract rewrite |
| Persistence | No application database found in inspected project | Contract records/events are authoritative |
| Deployment | Ganache `127.0.0.1:7545` (1337) and Sepolia | Separate DAO manifest and frontend env addresses |

## Versions and test baseline

Installed versions observed: Hardhat 3.13.0, OpenZeppelin Contracts 5.2.0 and ethers 6.17.0. `PHASE_STATUS.md` records 45 passing Mocha tests before this DAO work. The root `npm test` remains a placeholder; use `npx hardhat test mocha`.

## Compatibility and risks

- CDT balances do not count as voting power until delegated.
- Supply is fixed at 1,000 CDT; there is no mint function. The deployer can distribute only the initial allocation it holds.
- The deployment script self-delegates only when a recipient signer is available; otherwise recipients delegate from their wallets.
- The deployment must be paired with matching `VITE_DAO_TOKEN_ADDRESS`, `VITE_DAO_VOTING_ADDRESS`, and chain ID. Manifests are network-specific.
- The prior Ganache config contained a hardcoded development private key. It now requires `GANACHE_PRIVATE_KEY` from the environment, so the source and ZIP do not ship that key; local deployments need this setting.
- DAO approval is informational and does not transfer ETH or mark a request paid.
- This is an academic/MVP implementation and has not received an independent security audit.

The final local Ganache deployment is recorded in `deployments/dao-ganache.json` at block 56. A Vite-local ignored `.env.local` points this checkout at those chain-1337 addresses; the distributable `.env.example` contains blank DAO address values.
