
import { useEffect, useState } from "react";
import { BrowserProvider } from "ethers";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";

import "./index.css";
import FounderDashboard from "./pages/FounderDashboard";
import InvestorDashboard from "./pages/InvestorDashboard";
import LiquidityLab from "./pages/LiquidityLab";
import DexSwap from "./pages/DexSwap";
import OracleLab from "./pages/OracleLab";

function App() {
  const [account, setAccount] = useState("");
  const [currentPage, setCurrentPage] = useState("home");

  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();

  // Synchronize account from AppKit.
  useEffect(() => {
    setAccount(isConnected && address ? address : "");
  }, [address, isConnected]);

  // Keep MetaMask account changes synchronized too.
  useEffect(() => {
    if (!window.ethereum) return undefined;

    const handleAccountsChanged = (accounts) => {
      setAccount(accounts[0] || "");
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);

    return () => {
      window.ethereum.removeListener(
        "accountsChanged",
        handleAccountsChanged
      );
    };
  }, []);

  // Connect MetaMask directly.
  async function connectWallet() {
    if (!window.ethereum) {
      alert("Please install MetaMask or use the AppKit wallet button.");
      return;
    }

    try {
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);

      if (accounts.length > 0) {
        setAccount(accounts[0]);
      }
    } catch (error) {
      console.error("MetaMask connection failed:", error);
      alert("Wallet connection failed.");
    }
  }

  function shortenAddress(address) {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  function goHome() {
    setCurrentPage("home");
  }

  // Founder dashboard
  if (currentPage === "founder") {
    return (
      <FounderDashboard
        account={account}
        onBack={goHome}
        onConnect={() => open({ view: "Connect" })}
      />
    );
  }

  // Investor dashboard
  if (currentPage === "investor") {
    return (
      <InvestorDashboard
        account={account}
        onBack={goHome}
        onConnect={() => open({ view: "Connect" })}
      />
    );
  }
  if (currentPage === "liquidity") return <LiquidityLab account={account} onBack={goHome} />;
  if (currentPage === "swap") return <DexSwap account={account} onBack={goHome} />;
  if (currentPage === "oracle") return <OracleLab onBack={goHome} />;

  return (
    <div className="app">
      <nav className="navbar">
        <div className="logo">
          <div className="logo-icon">S</div>
          <div>
            <h2>StartFund</h2>
            <p>Decentralized Startup Funding</p>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
          }}
        >
          <button className="connect-btn" onClick={connectWallet}>
            {account ? shortenAddress(account) : "Connect MetaMask"}
          </button>

          <button
            className="connect-btn"
            onClick={() => open({ view: "Connect" })}
          >
            {isConnected ? shortenAddress(address) : "Connect Wallet"}
          </button>
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
              <button className="hero-btn" onClick={connectWallet}>
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
  );
}

export default App;
