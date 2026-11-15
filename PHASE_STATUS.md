# Implementation Phase Status

## Phase 0 - Repository Audit

### Tasks completed

- Inspected the repository layout, Hardhat configuration, package manifests, Solidity contracts, deployment scripts, tests, and React frontend entry points.
- Identified the existing `MockETHUSDOracle` and `SafeOracleReader` implementation.
- Identified existing Ganache DEX deployment/configuration and the current Oracle Lab UI.
- Identified breaking-change risks and the surfaces that must remain backward compatible.

### Files created or modified

- Created: `PHASE_STATUS.md`
- No existing source files were modified.

### Commands executed

- Repository file and structure inspection.
- `git status --short`
- `git ls-files`

### Test results

- Phase 0 is an audit-only phase; compilation and tests have not been run yet.
- No deployment was attempted.

### Remaining issues

- The baseline compilation and test suite still need to be executed in Phase 1.
- Chainlink's `AggregatorV3Interface` dependency is not present in the root dependency manifest.
- `SafeOracleReader.sol` currently validates price and freshness but has no custom errors, feed-address validation, description access, or ETH/USD conversion helper.
- `StartupFunding.sol` has no oracle integration and currently has no withdrawal, ownership, or governance functions despite the broader project description.
- `deployDEX.ts` is explicitly Ganache-only and writes a single `frontend/src/dexConfig.js` configuration.
- There is no separate Sepolia Chainlink deployment script or deployment-address persistence format.
- The frontend currently assumes Ganache for DEX/oracle screens, while `walletConfig.js` configures only Sepolia for AppKit.
- Existing generated frontend ABIs/configuration files contain deployment-specific addresses and must not be overwritten by a Sepolia deployment.
- The root `package.json` test script is a placeholder; Hardhat tests are present but require direct Hardhat commands.
- Sepolia deployment cannot be verified without user-provided RPC URL, private key, and funded testnet account; no deployment has been claimed.

### Baseline evidence

- `npm install` completed and installed 268 packages.
- Initial `npx hardhat build` failed with HHE22 because Hardhat was not installed locally; the failure was resolved by installing dependencies.
- Subsequent `npx hardhat build` compiled 11 Solidity files with solc 0.8.28.
- Subsequent `npx hardhat test` reported 41 passing Mocha tests.

## Phase 1-7 - Implementation

### Tasks completed

- Added Chainlink AggregatorV3 integration with immutable feed configuration.
- Added validation for non-positive prices, invalid timestamps, and stale data.
- Added 18-decimal USD conversion from wei.
- Added deterministic AggregatorV3 mock tests.
- Added informational StartupFunding USD valuation without changing investment rules.
- Added Sepolia-only deployment script and separate deployment output.
- Added network-aware frontend oracle dashboard with Ganache mock and Sepolia configuration.
- Added environment template and documentation/report sections.
- Preserved AMMPool swap calculations and existing funding contribution behavior.

### Files created or modified

- Created: `contracts/MockAggregatorV3.sol`
- Modified: `contracts/SafeOracleReader.sol`
- Modified: `contracts/StartupFunding.sol`
- Created: `test/SafeOracleReader.ts`
- Created: `scripts/deployChainlink.ts`
- Modified: `scripts/deployDEX.ts`
- Created: `frontend/src/config/oracleConfig.js`
- Modified: `frontend/src/pages/OracleLab.jsx`
- Created: `frontend/src/contracts/SafeOracleReader.json`
- Created: `frontend/src/contracts/MockETHUSDOracle.json`
- Created: `.env.example`
- Modified: `.gitignore`
- Modified: `README.md`
- Created: `docs/EXPERIMENT_7_REPORT.md`

### Commands executed

- `npm install`
- `npm install --prefix frontend --no-audit --no-fund`
- `npx hardhat build`
- `npx hardhat test`
- `npx tsc --noEmit`
- `npm --prefix frontend run build`
- `npm --prefix frontend run lint`
- `npx hardhat run scripts/deployChainlink.ts --network hardhatMainnet` with dummy variables to exercise the network guard.

### Test results

- Baseline: 41 passing Mocha tests.
- Final Hardhat suite: 45 passing Mocha tests.
- TypeScript validation: passed.
- Frontend production build: passed after restoring missing Windows native optional bindings and installing the required `viem` peer.
- Frontend lint: passed with existing React hook warnings; no lint errors.
- Deployment guard: correctly rejected a non-Sepolia target before deployment.
- Sepolia deployment has not been executed; no deployment address is claimed.

### Remaining issues

- The environment could not complete installation of `@chainlink/contracts`; the implementation uses a local interface matching the official `AggregatorV3Interface` ABI so compilation remains deterministic.
- Frontend lint retains pre-existing hook warnings in unrelated screens and one warning in the new dashboard effect; these do not fail lint.
- Sepolia frontend reader address remains empty until a real confirmed deployment.
- Rotate any RPC, API, or private-key credentials that were exposed during troubleshooting before reuse.
- Ganache deployment now supports `GANACHE_PRIVATE_KEY` and performs an address balance preflight.
- Sepolia deployment now sends ABI-encoded deployment bytecode directly to avoid the Hardhat 3 HTTP-provider `resolveName` limitation.
- Added `scripts/checkOracle.ts` for post-deployment Sepolia reader/feed/freshness verification.

## Phase 5 - React Frontend Integration

### Tasks completed

- Added network-aware oracle configuration for Ganache `1337` and Sepolia `11155111`.
- Wired the verified Sepolia reader address without changing Ganache deployment addresses.
- Added a shared ethers v6 oracle client and React hook using bigint-safe conversions.
- Added oracle loading, disconnected-wallet, unsupported-network, stale-data, retry,
  and unavailable-reader states.
- Added live oracle status to the funding dashboards and current-price USD estimates
  for raised amounts, goals, and individual contributions.
- Added Chainlink reference-price context to AMM liquidity and swap screens without
  changing reserve-based quote or transaction logic.
- Added Ganache to the Reown AppKit network list while preserving Sepolia, MetaMask,
  and existing navigation flows.

### Files created or modified

- Created: `frontend/src/oracle/oracleClient.js`
- Created: `frontend/src/oracle/useOracleData.js`
- Created: `frontend/src/components/OracleStatus.jsx`
- Modified: `frontend/src/config/oracleConfig.js`
- Modified: `frontend/src/walletConfig.js`
- Modified: `frontend/src/App.jsx`
- Modified: `frontend/src/pages/OracleLab.jsx`
- Modified: `frontend/src/pages/FounderDashboard.jsx`
- Modified: `frontend/src/pages/InvestorDashboard.jsx`
- Modified: `frontend/src/pages/LiquidityLab.jsx`
- Modified: `frontend/src/pages/DexSwap.jsx`
- Modified: `frontend/src/index.css`
- Modified: `README.md`
- Modified: `PHASE_STATUS.md`

### Commands executed

- `npm run build` (root; expected failure because root has no build script)
- `npm --prefix frontend run build` equivalent via `Set-Location frontend; npm run build`
- `Set-Location frontend; npm run lint`

### Test results

- Frontend production build: **PASS** (`vite v8.2.1`, exit code 0).
- Frontend lint: **PASS** with existing hook/dependency warnings; no errors.
- DEX and funding transaction paths were not modified.

### Remaining issues

- No frontend test script exists in `frontend/package.json`.
- Manual wallet verification on Ganache and Sepolia still requires the user's
  browser wallet, running RPC, and funded accounts.
- Sepolia StartupFunding valuation remains unavailable until a verified Sepolia
  StartupFunding address is configured; the UI does not guess one.
- Frontend build warns about large AppKit chunks and lint retains pre-existing
  hook warnings.

## Wallet Provider Selection Fix

### Tasks completed

- Added EIP-6963 provider discovery for independently announced browser wallets.
- Added explicit wallet selection and per-wallet account/chain tracking.
- Routed frontend reads and transactions through the selected wallet provider.
- Removed the duplicate second AppKit initialization while preserving the
  AppKit setup in `walletConfig.js`.
- Added missing-wallet, disconnected-wallet, and selected-provider error paths.

### Files created or modified

- Created: `frontend/src/walletManager.js`
- Modified: `frontend/src/App.jsx`
- Modified: `frontend/src/main.jsx`
- Modified: `frontend/src/walletConnect.js`
- Modified: `frontend/src/pages/OracleLab.jsx`
- Modified: `frontend/src/pages/FounderDashboard.jsx`
- Modified: `frontend/src/pages/InvestorDashboard.jsx`
- Modified: `frontend/src/pages/LiquidityLab.jsx`
- Modified: `frontend/src/pages/DexSwap.jsx`
- Modified: `frontend/src/oracle/useOracleData.js`
- Modified: `frontend/src/components/InvestorVaultPanel.jsx`
- Modified: `frontend/src/components/StakingPanel.jsx`
- Modified: `frontend/src/components/YieldFarmPanel.jsx`

### Commands executed

- `Set-Location .\frontend; npm run build`
- `Set-Location .\frontend; npm run lint`
- `Set-Location .\frontend; npm run dev -- --host 127.0.0.1`
- Opened `http://127.0.0.1:5173` in the integrated browser.

### Test results

- Frontend production build: **PASS**.
- Frontend lint: **PASS** with existing React hook/dependency warnings only.
- Browser smoke test without wallet extensions: **PASS**; the UI displayed
  `No injected wallet detected` and retained the Reown AppKit button.
- MetaMask/Rabby transaction testing requires the user's browser extensions and
  was not falsely reported as completed in this environment.

  ## Explicit Wallet Connection and Provider Detection Fix

  ### Root cause

  - The previous manager persisted a selected wallet in browser storage and fell
    back to `window.ethereum`, which can be MetaMask, Rabby, or an injected
    multiplexer rather than the wallet the user intended.
  - Startup monitoring called account/network refresh before user consent, so
    addresses appeared automatically.
  - AppKit account state was read without requiring an explicit WalletConnect
    choice, allowing restored AppKit state to compete with injected-wallet state.

  ### Tasks completed

  - Replaced persisted/fallback selection with an in-memory EIP-6963 provider registry.
  - Added legacy fallback enumeration through `window.ethereum.providers` only when
    EIP-6963 announcements are unavailable.
  - Added explicit Connect Wallet modal with separate MetaMask, Rabby Wallet, and
    WalletConnect choices.
  - Prevented account and chain reads until the user selects and approves a wallet.
  - Reads each selected injected provider's `eth_chainId` directly after connection.
  - Keeps provider, account, chain ID, and connected state independent per wallet.
  - Added DApp Disconnect that clears local connection state without removing the
    wallet from the browser.
  - Routed Oracle, funding, staking, vault, liquidity, and DEX operations through
    the selected connected provider.
  - Preserved one Reown AppKit initialization and explicit WalletConnect opening.

  ### Files created or modified

  - Modified: `frontend/src/walletManager.js`
  - Modified: `frontend/src/App.jsx`
  - Modified: `frontend/src/index.css`
  - Modified: `frontend/src/pages/OracleLab.jsx`
  - Modified: `frontend/src/pages/FounderDashboard.jsx`
  - Modified: `frontend/src/pages/InvestorDashboard.jsx`
  - Modified: `frontend/src/pages/LiquidityLab.jsx`
  - Modified: `frontend/src/pages/DexSwap.jsx`
  - Modified: `frontend/src/oracle/useOracleData.js`
  - Modified: `frontend/src/components/InvestorVaultPanel.jsx`
  - Modified: `frontend/src/components/StakingPanel.jsx`
  - Modified: `frontend/src/components/YieldFarmPanel.jsx`

  ### Commands and actual results

  - `Set-Location .\frontend; npm run build` — **PASS**
  - `Set-Location .\frontend; npm run lint` — **PASS**, existing hook/dependency warnings only
  - `Set-Location .\frontend; npm run dev -- --host 127.0.0.1` — **PASS**
  - Browser opened at `http://127.0.0.1:5173` — **PASS**
  - Fresh browser header showed only `Connect Wallet`; no address was auto-connected.
  - Connect modal showed `WalletConnect` and correctly reported no injected wallet in
    the extension-free browser environment.
  - POST `eth_chainId` to `http://127.0.0.1:7545` returned `0x539` (`1337`).

  ### Not claimed

  - MetaMask `eth_chainId = 0xaa36a7` and Rabby `eth_chainId = 0x539` could not be
    executed in this environment because the active browser has no wallet extensions.
  - No private keys, seed phrases, or environment-file contents were requested or read.
  - No Solidity contracts or deployment addresses were changed.
  - WalletConnect now registers AppKit's selected EIP-1193 provider and reports
    AppKit's actual selected chain ID, so contract screens use the same provider
    as the displayed WalletConnect account.

  ## Oracle Dashboard Converter Fix

  ### Root cause

  The converter result was stored independently and only updated by its button
  handler. Refreshing the oracle price updated the dashboard price but did not
  clear or recalculate the existing `usdValue`, leaving the previous conversion
  visible.

  ### Tasks completed

  - Recalculate conversion from the latest validated oracle price whenever the
    oracle reading or ETH input changes.
  - Use the raw feed price and its on-chain decimals (`8` on the verified feeds).
  - Clear previous conversion output while oracle data refreshes.
  - Show conversion loading state.
  - Reject stale/invalid oracle data instead of calculating.
  - Preserve Ganache mock and Sepolia Chainlink reader behavior.

  ### Files modified

  - Modified: `frontend/src/pages/OracleLab.jsx`
  - Modified: `PHASE_STATUS.md`

  ### Validation

  - `Set-Location .\frontend; npm run build` — **PASS**
  - `Set-Location .\frontend; npm run lint` — **PASS**, existing React hook/dependency warnings only.
  - Exact bigint-safe arithmetic verification:
    - `2500` × `0.5 ETH` = `$1250`
    - `3000` × `0.5 ETH` = `$1500`
    - `2000` × `0.5 ETH` = `$1000`

  ## Oracle Verifier Network Selection Fix

  ### Root cause

  `scripts/checkOracle.ts` hardcoded `HARDHAT_NETWORK || "sepolia"` and created a
  Sepolia connection, so `--network ganache` could still print Sepolia. It also
  used the machine wall clock for freshness, which can disagree with Ganache's
  chain timestamp.

  ### Tasks completed

  - Read the active Hardhat connection name from `network.create().networkName`.
  - Read the actual provider chain ID through `eth_chainId`.
  - Added explicit Ganache `1337` and Sepolia `11155111` target resolution.
  - Added clear errors for unsupported network/chain combinations and missing
    Sepolia reader deployment addresses.
  - Added network-specific reader/feed verification and detailed validation output.
  - Calculate oracle age against the latest blockchain block timestamp.
  - Added unit tests for Ganache selection, Sepolia selection, mismatches, and
    missing deployment addresses.

  ### Files created or modified

  - Created: `scripts/oracleVerificationConfig.ts`
  - Created: `test/checkOracleConfig.ts`
  - Modified: `scripts/checkOracle.ts`
  - Modified: `PHASE_STATUS.md`

  ### Commands and actual results

  - `npx hardhat build` — **PASS**
  - `npx tsc --noEmit` — **PASS**
  - `npx hardhat test --grep "checkOracle network selection"` — **4 passing**
  - `npx hardhat test` — **49 passing**
  - `npx hardhat run scripts/checkOracle.ts --network ganache` — **PASS**
    - network: `ganache`
    - chainId: `1337`
    - reader: `0x98B084740438068F5c157e00D9c292033816E300`
    - feed: `0x3e014816C849aBD0ddf4f2D00cF4767Eb6BA0fa0`
    - price: `250000000000`
    - decimals: `8`
    - age: `0`
    - validation: all true
  - `npx hardhat run scripts/checkOracle.ts --network sepolia` — **PASS**
    - network: `sepolia`
    - chainId: `11155111`
    - reader: `0x9e78cDB124703E57686E9363D3B152E2cE99e1f8`
    - feed: `0x694AA1769357215DE4FAC081bf1f309aDC325306`
    - price: `224196622091`
    - decimals: `8`
    - age: `828` seconds
    - validation: all true

### Manual wallet verification

With MetaMask and Rabby installed, the header should show separate EIP-6963
buttons. Selecting Rabby and connecting on Ganache should show chain `1337`
and route Oracle Lab reads through the Rabby provider. Selecting MetaMask
should independently show its account and current network. Contract addresses
and Solidity files were not changed.

### Beginner verification instructions

1. Start Ganache on `http://127.0.0.1:7545` and ensure the deployed addresses in
   `frontend/src/dexConfig.js` are still present.
2. Run `Set-Location .\frontend; npm run dev`, open the displayed URL, and connect
   MetaMask to Ganache. Open Oracle Dashboard and confirm chain `1337`, mock feed,
   price, decimals, update time, and `Fresh` status.
3. Open Founder or Investor Dashboard and confirm ETH totals have a
   `current USD estimate` beside them. Submit a normal funding transaction to
   verify oracle reads did not gate funding.
4. Open Liquidity Lab or DEX Swap and confirm the AMM reserve quote remains the
   execution value while Chainlink appears only as reference context.
5. Switch MetaMask to Sepolia. Confirm the Oracle Dashboard uses reader
   `0x9e78cDB124703E57686E9363D3B152E2cE99e1f8` and the official feed. A missing
   Sepolia funding address should be reported as unavailable, not fabricated.

## Ganache Mock Oracle Verification Milestone

### Tasks completed

- Added `scripts/checkGanacheOracle.ts`.
- Connected to the existing Ganache deployment without changing deployment addresses.
- Verified chain ID, owner authorization, reader feed, freshness configuration, initial price, decimals, and timestamp.
- Updated the deployed mock price through its existing owner-only `setPrice(int256)` function.
- Verified the updated value through `SafeOracleReader`.
- Verified invalid-price and stale-price rejection, then restored fresh readable data.

### Commands executed

- `npx tsc --noEmit`
- `npx hardhat build`
- `npx hardhat run scripts/checkGanacheOracle.ts --network ganache`

### Test results

- Ganache verification: **PASS (11/11)**.
- Chain ID: `1337`.
- Initial mock price: `250000000000` with 8 decimals.
- Updated mock price: `300000000000` with 8 decimals.
- Invalid `setPrice(0)`: rejected.
- Stale reader read: rejected.
- Freshness recovery: passed.

### Remaining issues

- No issues in this Ganache milestone.

### Ganache gas-fix verification

- Updated `scripts/checkGanacheOracle.ts` to estimate `setPrice` gas, inspect the latest Ganache block gas limit, submit with a justified explicit limit of twice the estimate, await `tx.wait()`, and require receipt status `1`.
- The invalid-price case now waits for the actual reverted transaction rather than treating transaction submission alone as proof.
- Verification command: `npx hardhat run scripts/checkGanacheOracle.ts --network ganache`
- Actual result: **PASS (11/11)**.
- Measured setter gas: `35,460`; submitted gas limit: `70,920`; Ganache block gas limit: `6,721,975`.
- Confirmed update transaction: `0x0d8917e98b5eabbbdb493b77e507af8b30f8477ac9252bf266b66399292f1df2`.
- Confirmed freshness-recovery transaction: `0x25a318948930f74f20403ca16aea9cb50d96506842bfc2e3b8b07e679aa7563f`.
- Root cause: the prior transaction path relied on the provider's default gas handling and could fail with an out-of-gas error even though the setter's estimated gas was well below Ganache's block limit. No Solidity change was required.
- Updated the verifier target to `350000000000` and added assertions that the target differs from the captured initial price and matches both the direct mock feed and `SafeOracleReader`.
- Actual price-change verification: `300000000000 -> 350000000000`; result **PASS (11/11)**.
- Price-change transaction: `0x4a09770f489656996945e699cbb692b356d97e3745882d184d683bf80ac22a7d`.
- Reworked `checkGanacheOracle.ts` for repeatable executions: it calculates `nextPrice = initialPrice + 50000000000n`, asserts the direct and reader values both equal that dynamic target and differ from the initial value, and uses a separate recovery price/check.
- Repeat execution result: **PASS (11/11)** with `450000000000 -> 500000000000`; update transaction `0x12151fd973f5b1273141d5b58dcc77849bf7378d0ba0610fa6d0681c0d14430e`.

### Next steps

1. Provide Sepolia RPC credentials and a funded test account only when testnet deployment is desired.
2. Run `npx hardhat run scripts/deployChainlink.ts --network sepolia`.
3. Copy the confirmed reader address into `VITE_SEPOLIA_ORACLE_READER_ADDRESS`.
4. Perform independent smart-contract audit and explorer verification before production use.

## Phase 8 - Explicit Multi-Wallet Connection Fix

### Root cause

The browser-wallet path wrapped the selected provider in `BrowserProvider` before
requesting accounts, which obscured the exact EIP-1193 provider involved in the
connection request. The UI also treated AppKit state separately from injected
wallet state and threw during startup when WalletConnect had no project ID.
That combination could make MetaMask selection appear inert, allow provider
state to compete, and prevent injected wallets from working independently.

### Tasks completed

- Requests accounts and reads `eth_chainId` directly from the selected EIP-6963
  provider.
- Verifies MetaMask and Rabby provider identity using EIP-6963 `rdns` metadata
  and provider identity flags.
- Stores provider, signer, account, chain ID, connection state, loading state,
  and connection error in the central wallet manager.
- Handles `accountsChanged`, `chainChanged`, and `disconnect` for each provider.
- Keeps one selected wallet/account state for the header and dashboard props.
- Shows one explicit Connect Wallet flow and a reusable modal on all dashboard
  routes; no wallet permission request occurs on initial load.
- Disables WalletConnect with a clear not-configured label when
  `VITE_WALLETCONNECT_PROJECT_ID` is empty, without blocking injected wallets.
- Preserves the existing Reown AppKit path when a real project ID is configured.

### Files modified

- `frontend/src/walletManager.js`
- `frontend/src/walletConfig.js`
- `frontend/src/App.jsx`
- `PHASE_STATUS.md`

### Commands and actual results

- `Set-Location .\frontend; npm run build` — **PASS** (`vite v8.2.1`, exit code 0).
- `Set-Location .\frontend; npm run lint` — **PASS** with existing React hook
  warnings and one intentional AppKit bridge dependency warning; no errors.
- `npx hardhat build` — **PASS**, no contracts to compile.
- `npx hardhat test` — **PASS**, 49 passing.
- Started `Set-Location .\frontend; npm run dev -- --host 127.0.0.1` and opened
  `http://127.0.0.1:5173`.
- Browser smoke check confirmed a fresh load shows a single disconnected
  `Connect Wallet` header button and no account.
- Opening the modal in the available browser environment showed no injected
  wallet installed and the WalletConnect option; no MetaMask/Rabby extensions
  were available for popup or chain-ID verification.
- The first smoke click exposed a React update-depth loop in the AppKit bridge;
  its effect dependency was corrected. Reload and modal-open smoke checks then
  completed without runtime errors.

### Remaining issues

- Actual MetaMask and Rabby popup approval/rejection, independent addresses,
  provider-specific `eth_chainId` values (`0xaa36a7` and `0x539`), and account
  switching require a browser profile with those extensions installed.
- WalletConnect remains intentionally unavailable until the user supplies a
  real project ID through environment configuration.

### Beginner verification instructions

1. Start Ganache at `http://127.0.0.1:7545`, then run
   `Set-Location .\frontend; npm run dev`.
2. Open the Vite URL in a browser profile with MetaMask and Rabby installed.
   On a fresh tab, confirm only `Connect Wallet` is shown.
3. Select Rabby Wallet. Approve its popup and confirm the header shows the Rabby
   address and chain `1337`; open Oracle Lab and confirm the Ganache reader is
   used.
4. Disconnect, select MetaMask, and confirm only MetaMask opens a permission
   popup. On Sepolia, confirm the header shows chain `11155111` and Oracle Lab
   uses the Sepolia reader.
5. Switch the selected wallet between Ganache and Sepolia and confirm its chain
   ID changes while the other wallet remains unselected. Reject a popup and
   confirm the modal displays a user-facing rejection message.

## Phase 9 - Live Chain-ID Diagnostics

### Root cause

The wallet manager already queried `eth_chainId`, but it retained only the
normalized number and did not expose the raw response, provider identity, or
chain-change payload. The UI therefore provided no evidence when a wallet UI
and DApp network label disagreed. Additionally, some dashboard components were
keyed only by account, so switching networks with the same account could leave
network-specific data mounted until a timer refresh.

### Tasks completed

- Added direct-provider raw chain-ID capture with decimal/hex normalization.
- Added selected-provider identity diagnostics from EIP-6963 metadata and
  provider flags.
- Recorded the latest `chainChanged` event payload.
- Refreshes account, signer, raw chain ID, normalized chain ID, and connected
  state from the selected provider after every network event.
- Added temporary diagnostics showing selected wallet, provider identity,
  account, raw chain ID, normalized chain ID, supported expected IDs, last
  `chainChanged` event, and network status.
- Remounted network-sensitive dashboards when the selected chain changes so
  Ganache and Sepolia contract/oracle configuration cannot remain mounted
  across a network switch.
- Preserved user-controlled connections and did not request or force network
  switching.

### Files modified

- `frontend/src/walletManager.js`
- `frontend/src/App.jsx`
- `PHASE_STATUS.md`

### Commands and actual results

- `Set-Location .\frontend; npm run build` — **PASS** (`vite v8.2.1`, exit code 0).
- `Set-Location .\frontend; npm run lint` — **PASS**, existing React hook
  warnings only.
- `git diff --check` — **PASS**.

### Manual verification status

The shared browser profile did not expose MetaMask or Rabby providers, so an
actual extension-backed comparison could not be claimed. With MetaMask
connected, the diagnostics must show its provider identity and direct raw
response (`0x539` on Ganache or `0xaa36a7` on Sepolia), with normalized values
`1337` or `11155111` respectively. The selected network name and contract
configuration must change only after that provider response is refreshed.

## Phase 10 - Final Wallet Connection Cleanup

### Tasks completed

- Removed the temporary Wallet Diagnostics panel from the application UI.
- Retained development-only console diagnostics for wallet selection, provider
  identity, chain changes, refreshes, and disconnects.
- Kept direct `eth_chainId` validation and all account/network event handling.
- Ensured selecting MetaMask or Rabby clears WalletConnect selection intent before
  connecting, preventing AppKit from overwriting the selected injected provider.
- WalletConnect now reads its own provider's accounts and `eth_chainId`.
- Injected wallets first use `eth_accounts`; permission is requested only when
  no authorized account exists.
- Header now displays wallet name, shortened account, actual supported network
  name, and chain ID; unsupported chains are labeled explicitly.
- No connection persistence or automatic reconnect was added. A fresh visit
  remains disconnected unless the user explicitly selects a wallet.

### Files modified

- `frontend/src/App.jsx`
- `frontend/src/walletManager.js`
- `PHASE_STATUS.md`

### Commands and actual results

- `Set-Location .\frontend; npm run build` — **PASS** (`vite v8.2.1`).
- `Set-Location .\frontend; npm run lint` — **PASS**, existing React hook
  warnings only.
- `npx hardhat test` — **PASS**, 49 passing.
- Confirmed the source no longer references `WalletDiagnostics` or
  `wallet-diagnostics`; underlying network configuration remains in use by
  `oracleClient.js` and dashboard reads.

### Final acceptance limitations

The available browser profile does not expose MetaMask, Rabby, or a configured
WalletConnect session. Therefore live popup approval, extension account
switching, and provider-specific Ganache/Sepolia acceptance tests require the
user's extension-enabled browser profile and are not claimed as executed here.

## Phase 11 - Dynamic MetaMask Network Switching

### Root cause

The selected provider did receive `chainChanged`, but the handler only started
an asynchronous refresh. The selected wallet state remained on the previous
chain until both RPC reads and signer creation completed. In parallel, oracle
requests had no generation guard, so a slower read from the previous network
could overwrite a newer network result.

### Tasks completed

- Updates the selected wallet's raw and normalized chain ID immediately on the
  exact provider's `chainChanged` event.
- Rebuilds the signer from the selected provider after account/network refresh.
- Invalidates older wallet refreshes and oracle reads so stale responses cannot
  overwrite newer network state.
- Reinitializes network-sensitive pages through the existing account/chain React
  keys, preserving dynamic Ganache/Sepolia configuration.
- Refreshes account and signer immediately on `accountsChanged`.
- Clears state and invalidates pending reads on provider `disconnect`.
- Removes listeners from replaced provider instances and on monitoring cleanup.
- Preserves unsupported-network handling and does not request or force network
  switching.

### Files modified

- `frontend/src/walletManager.js`
- `frontend/src/oracle/useOracleData.js`
- `PHASE_STATUS.md`

### Commands and actual results

- `Set-Location .\frontend; npm run build` — **PASS** (`vite v8.2.1`).
- `Set-Location .\frontend; npm run lint` — **PASS**, existing React hook
  warnings only.
- `npx hardhat test` — **PASS**, 49 passing.
- `git diff --check` — **PASS**.

### Manual acceptance status

The available browser profile has no MetaMask/Rabby extension provider, so live
Ganache-to-Sepolia switching, account switching, and extension disconnect
events could not be truthfully executed here. The implementation is prepared
for those tests without changing contract addresses or requiring disconnect/reconnect.
