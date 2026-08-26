import { useState } from "react";
import { BrowserProvider } from "ethers";
import "./index.css";

import FounderDashboard from "./pages/FounderDashboard";
import InvestorDashboard from "./pages/InvestorDashboard";

function App() {
  const [account, setAccount] = useState("");
  const [currentPage, setCurrentPage] = useState("home");

  // ==============================
  // CONNECT METAMASK
  // ==============================

  async function connectWallet() {
    if (!window.ethereum) {
      alert("Please install MetaMask.");
      return;
    }

    try {
      const provider = new BrowserProvider(window.ethereum);

      const accounts = await provider.send(
        "eth_requestAccounts",
        []
      );

      setAccount(accounts[0]);
    } catch (error) {
      console.error(error);
      alert("Wallet connection failed.");
    }
  }

  // ==============================
  // SHORTEN WALLET ADDRESS
  // ==============================

  function shortenAddress(address) {
    if (!address) return "";

    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  // ==============================
  // GO BACK HOME
  // ==============================

  function goHome() {
    setCurrentPage("home");
  }

  // ==============================
  // FOUNDER DASHBOARD
  // ==============================

  if (currentPage === "founder") {
    return (
      <FounderDashboard
        account={account}
        onBack={goHome}
      />
    );
  }

  // ==============================
  // INVESTOR DASHBOARD
  // ==============================

  if (currentPage === "investor") {
    return (
      <InvestorDashboard
        account={account}
        onBack={goHome}
      />
    );
  }

  // ==============================
  // HOME PAGE
  // ==============================

  return (
    <div className="app">

      {/* ================= NAVBAR ================= */}

      <nav className="navbar">

        <div className="logo">

          <div className="logo-icon">
            S
          </div>

          <div>
            <h2>StartFund</h2>

            <p>
              Decentralized Startup Funding
            </p>
          </div>

        </div>


        <button
          className="connect-btn"
          onClick={connectWallet}
        >
          {account
            ? shortenAddress(account)
            : "Connect MetaMask"}
        </button>

      </nav>


      {/* ================= MAIN ================= */}

      <main>

        {/* ================= HERO ================= */}

        <section className="hero">

          <div className="hero-content">

            <span className="badge">
              BLOCKCHAIN-BASED FUNDING
            </span>


            <h1>
              Fund the next
              <br />
              <span>great idea.</span>
            </h1>


            <p>
              A decentralized platform where founders
              raise funds and investors support promising
              startups using blockchain technology.
            </p>


            {!account && (

              <button
                className="hero-btn"
                onClick={connectWallet}
              >
                Connect Wallet →
              </button>

            )}


            {account && (

              <div className="connected-message">
                Wallet Connected:{" "}
                {shortenAddress(account)}
              </div>

            )}

          </div>


          {/* ================= VISUAL ================= */}

          <div className="hero-visual">

            <div className="visual-circle">

              <div className="visual-content">

                <span>
                  WEB3
                </span>

                <strong>
                  Innovation
                </strong>

              </div>

            </div>

          </div>

        </section>


        {/* ================= ROLE SELECTION ================= */}

        <section className="roles">

          <div className="section-heading">

            <span>
              GET STARTED
            </span>

            <h2>
              What brings you here?
            </h2>

            <p>
              Choose how you want to use the platform.
            </p>

          </div>


          <div className="role-container">


            {/* ================= FOUNDER ================= */}

            <div className="role-card">

              <div className="role-icon">
                ◈
              </div>


              <div>

                <small>
                  01
                </small>


                <h3>
                  I'm a Founder
                </h3>


                <p>
                  Register your startup, set a funding
                  goal and raise funds from investors.
                </p>


                <button
                  onClick={() => {

                    if (!account) {
                      alert(
                        "Please connect your MetaMask wallet first."
                      );

                      return;
                    }

                    setCurrentPage("founder");

                  }}
                >
                  Continue as Founder →
                </button>

              </div>

            </div>


            {/* ================= INVESTOR ================= */}

            <div className="role-card">

              <div className="role-icon investor">
                ◇
              </div>


              <div>

                <small>
                  02
                </small>


                <h3>
                  I'm an Investor
                </h3>


                <p>
                  Discover promising startups and invest
                  using cryptocurrency.
                </p>


                <button
                  onClick={() => {

                    if (!account) {
                      alert(
                        "Please connect your MetaMask wallet first."
                      );

                      return;
                    }

                    setCurrentPage("investor");

                  }}
                >
                  Continue as Investor →
                </button>

              </div>

            </div>


          </div>

        </section>

      </main>


      {/* ================= FOOTER ================= */}

      <footer>

        <strong>
          StartFund
        </strong>

        <p>
          Blockchain-Based Startup Funding and Governance Platform
        </p>

      </footer>

    </div>
  );
}

export default App;