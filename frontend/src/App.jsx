
import { useEffect, useRef, useState } from "react";
import {
  useAppKit,
  useAppKitAccount,
  useAppKitNetwork,
  useAppKitProvider,
} from "@reown/appkit/react";
import { walletConnectEnabled } from "./walletConfig";

import "./index.css";
import FounderDashboard from "./pages/FounderDashboard";
import InvestorDashboard from "./pages/InvestorDashboard";
import LiquidityLab from "./pages/LiquidityLab";
import DexSwap from "./pages/DexSwap";
import OracleLab from "./pages/OracleLab";
import DAOGovernance from "./pages/DAOGovernance";
import { getOracleNetwork } from "./config/oracleConfig";
import {
  connectWallet,
  connectWalletConnect,
  disconnectWallet,
  getWalletLabel,
  selectWallet,
  startWalletMonitoring,
  subscribeWallets,
} from "./walletManager";

function AppKitBridge({ onReady, walletConnectRequested }) {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { chainId } = useAppKitNetwork();
  const { walletProvider } = useAppKitProvider("eip155");
  const openRef = useRef(open);

  useEffect(() => {
    onReady({ open: openRef.current, available: true });
  }, [onReady]);

  useEffect(() => {
    if (walletConnectRequested && isConnected && address && walletProvider && chainId !== undefined) {
      connectWalletConnect(walletProvider, address, chainId);
    }
  }, [address, chainId, isConnected, walletConnectRequested, walletProvider]);

  return null;
}

function WalletModal({
  open,
  wallets,
  selected,
  error,
  onClose,
  onConnect,
  onWalletConnect,
}) {
  return open ? (
    <div className="wallet-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="wallet-modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>Connect Wallet</h2>
        <p>Select one wallet. StartFund will not connect other installed wallets.</p>
        {wallets.map((wallet) => (
          <button
            className="wallet-option"
            key={wallet.info.uuid}
            disabled={wallet.isConnecting}
            onClick={() => onConnect(wallet.info.uuid)}
          >
            {getWalletLabel(wallet)}
            {wallet.isConnecting ? " (connecting...)" : ""}
          </button>
        ))}
        <button
          className="wallet-option"
          disabled={!onWalletConnect}
          onClick={onWalletConnect || undefined}
        >
          WalletConnect
          {!onWalletConnect ? " (not configured)" : ""}
        </button>
        {wallets.length === 0 && <p>No injected wallet is installed.</p>}
        {selected?.connectionError && <p className="error-message">{selected.connectionError}</p>}
        {error && <p className="error-message">{error}</p>}
        <button className="wallet-modal-close" onClick={onClose}>Cancel</button>
      </section>
    </div>
  ) : null;
}

function App() {
  const [currentPage, setCurrentPage] = useState("home");
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [walletConnectRequested, setWalletConnectRequested] = useState(false);
  const [appKit, setAppKit] = useState({ open: null, available: false });
  const [walletState, setWalletState] = useState({
    wallets: [],
    selected: null,
  });
  const account = walletState.selected?.connected
    ? walletState.selected.account
    : "";

  useEffect(() => subscribeWallets(setWalletState), []);

  useEffect(() => {
    const stop = startWalletMonitoring();
    return stop;
  }, []);

  async function connectBrowserWallet(uuid) {
    setConnectionError("");
    setWalletConnectRequested(false);
    selectWallet(uuid);
    try {
      await connectWallet(uuid);
      setWalletModalOpen(false);
    } catch (error) {
      setConnectionError(error?.message || "Wallet connection failed.");
    }
  }

  function disconnect() {
    if (walletState.selected?.connected) disconnectWallet(walletState.selectedId);
    setWalletConnectRequested(false);
    setConnectionError("");
  }

  function shortenAddress(address) {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  function networkLabel(chainId) {
    const network = getOracleNetwork(chainId);
    return network ? `${network.name} (${chainId})` : `Unsupported network (${chainId ?? "unknown"})`;
  }

  function goHome() {
    setCurrentPage("home");
  }

  const appKitBridge = walletConnectEnabled;
  const walletModal = (
    <WalletModal
      open={walletModalOpen}
      wallets={walletState.wallets}
      selected={walletState.selected}
      error={connectionError}
      onClose={() => setWalletModalOpen(false)}
      onConnect={connectBrowserWallet}
      onWalletConnect={
        appKit.available && appKit.open
          ? () => {
              setWalletConnectRequested(true);
              setWalletModalOpen(false);
              appKit.open({ view: "Connect" });
            }
          : null
      }
    />
  );

  // Founder dashboard
  if (currentPage === "founder") {
    return (
      <>
        {appKitBridge && <AppKitBridge onReady={setAppKit} walletConnectRequested={walletConnectRequested} />}
        {walletModal}
        <FounderDashboard key={`${account}:${walletState.chainId ?? ""}`} account={account} onBack={goHome} onConnect={() => setWalletModalOpen(true)} onDAO={() => setCurrentPage("dao")} />
      </>
    );
  }

  // Investor dashboard
  if (currentPage === "investor") {
    return (
      <>
        {appKitBridge && <AppKitBridge onReady={setAppKit} walletConnectRequested={walletConnectRequested} />}
        {walletModal}
        <InvestorDashboard key={`${account}:${walletState.chainId ?? ""}`} account={account} onBack={goHome} onConnect={() => setWalletModalOpen(true)} onDAO={() => setCurrentPage("dao")} />
      </>
    );
  }
  if (currentPage === "liquidity") return <>{appKitBridge && <AppKitBridge onReady={setAppKit} walletConnectRequested={walletConnectRequested} />}{walletModal}<LiquidityLab key={`${account}:${walletState.chainId ?? ""}`} account={account} onBack={goHome} /></>;
  if (currentPage === "swap") return <>{appKitBridge && <AppKitBridge onReady={setAppKit} walletConnectRequested={walletConnectRequested} />}{walletModal}<DexSwap key={`${account}:${walletState.chainId ?? ""}`} account={account} onBack={goHome} /></>;
  if (currentPage === "oracle") return <>{appKitBridge && <AppKitBridge onReady={setAppKit} walletConnectRequested={walletConnectRequested} />}{walletModal}<OracleLab key={`${account}:${walletState.chainId ?? ""}`} account={account} onBack={goHome} /></>;
  if (currentPage === "dao") return <>{appKitBridge && <AppKitBridge onReady={setAppKit} walletConnectRequested={walletConnectRequested} />}{walletModal}<DAOGovernance key={`${account}:${walletState.chainId ?? ""}`} account={account} onBack={goHome} onConnect={() => setWalletModalOpen(true)} /></>;

  return (
    <>
      {appKitBridge && <AppKitBridge onReady={setAppKit} walletConnectRequested={walletConnectRequested} />}
      {walletModal}
      <div className="app">
      <nav className="navbar">
        <div className="logo">
          <div className="logo-icon">S</div>
          <div>
            <h2>StartFund</h2>
            <p>Decentralized Startup Funding</p>
          </div>
        </div>

        <button className="connect-btn" onClick={() => setCurrentPage("dao")}>DAO Governance</button>

        <div
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
          }}
        >
          {account ? (
            <>
              <span className="wallet-info">
                {getWalletLabel(walletState.selected)}{" "}
                {shortenAddress(account)} · {networkLabel(walletState.selected?.chainId)}
              </span>
              <button className="connect-btn" onClick={disconnect}>Disconnect</button>
            </>
          ) : (
            <button className="connect-btn" onClick={() => setWalletModalOpen(true)}>
              Connect Wallet
            </button>
          )}
        </div>
      </nav>

      <main>
        <section className="hero">
          <div className="hero-content">
            <span className="badge">BLOCKCHAIN-BASED FUNDING</span>

            <h1>
              Fund the next
              <br />
              <span>great idea.</span>
            </h1>

            <p>
              A decentralized platform where founders raise funds and
              investors support promising startups using blockchain
              technology.
            </p>

            {!account && (
              <button className="hero-btn" onClick={() => setWalletModalOpen(true)}>
                Connect Wallet →
              </button>
            )}

            {account && (
              <div className="connected-message">
                Wallet Connected: {shortenAddress(account)}
              </div>
            )}
          </div>

          <div className="hero-visual">
            <div className="visual-circle">
              <div className="visual-content">
                <span>WEB3</span>
                <strong>Innovation</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="roles">
          <div className="section-heading">
            <span>GET STARTED</span>
            <h2>What brings you here?</h2>
            <p>Choose how you want to use the platform.</p>
          </div>

          <div className="role-container">
            <div className="role-card">
              <div className="role-icon">◈</div>
              <div>
                <small>01</small>
                <h3>I'm a Founder</h3>
                <p>
                  Register your startup, set a funding goal and raise funds
                  from investors.
                </p>
                <button
                  onClick={() => {
                    if (!account) {
                      alert("Please connect a wallet first.");
                      return;
                    }
                    setCurrentPage("founder");
                  }}
                >
                  Continue as Founder →
                </button>
              </div>
            </div>

            <div className="role-card">
              <div className="role-icon investor">◇</div>
              <div>
                <small>02</small>
                <h3>I'm an Investor</h3>
                <p>
                  Discover promising startups and invest using
                  cryptocurrency.
                </p>
                <button
                  onClick={() => {
                    if (!account) {
                      alert("Please connect a wallet first.");
                      return;
                    }
                    setCurrentPage("investor");
                  }}
                >
                  Continue as Investor →
                </button>
              </div>
            </div>

            <div className="role-card dex-card">
              <div className="role-icon">⇄</div>
              <div>
                <small>03</small>
                <h3>Decentralized Exchange</h3>
                <p>
                  Explore liquidity pools, swap tokens, and view oracle prices
                  in a local blockchain environment.
                </p>
                <div className="dex-actions">
                  <button onClick={() => setCurrentPage("liquidity")}>
                    Liquidity Lab →
                  </button>
                  <button onClick={() => setCurrentPage("swap")}>
                    DEX Swap →
                  </button>
                  <button onClick={() => setCurrentPage("oracle")}>
                    Oracle Lab →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <strong>StartFund</strong>
        <p>Blockchain-Based Startup Funding and Governance Platform</p>
      </footer>
      </div>
    </>
  );
}

export default App;
