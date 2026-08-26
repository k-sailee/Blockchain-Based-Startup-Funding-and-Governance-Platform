import { useEffect, useState } from "react";
import {
  BrowserProvider,
  Contract,
  formatEther,
  parseEther,
} from "ethers";

import {
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
} from "../contractConfig";

import "../index.css";

function InvestorDashboard({ account, onBack }) {
  const [startups, setStartups] = useState([]);
  const [loading, setLoading] = useState(true);

  const [investmentAmounts, setInvestmentAmounts] =
    useState({});

  const [investingId, setInvestingId] =
    useState(null);

  const [message, setMessage] = useState("");

  // ---------------------------------------------------------
  // Helper: Shorten wallet address
  // ---------------------------------------------------------

  function shortenAddress(address) {
    if (!address) return "";

    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  // ---------------------------------------------------------
  // Helper: Calculate funding progress
  // ---------------------------------------------------------

  function calculateProgress(raised, goal) {
    if (goal === 0n) {
      return 0;
    }

    const progress =
      (Number(raised) / Number(goal)) * 100;

    return Math.min(progress, 100);
  }

  // ---------------------------------------------------------
  // Load ALL startups
  // ---------------------------------------------------------

  async function loadStartups() {
    if (!window.ethereum || !account) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const provider =
        new BrowserProvider(
          window.ethereum
        );

      const contract = new Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        provider
      );

      const count =
        await contract.startupCount();

      const loadedStartups = [];

      // Get every startup
      for (
        let i = 1;
        i <= Number(count);
        i++
      ) {
        const startup =
          await contract.getStartup(i);

        // Get investors
        const investmentCount =
          await contract.getInvestmentCount(i);

        const investors = [];

        for (
          let j = 0;
          j < Number(investmentCount);
          j++
        ) {
          const investment =
            await contract.getInvestment(
              i,
              j
            );

          investors.push({
            address: investment[0],
            amount: investment[1],
          });
        }

        loadedStartups.push({
          id: Number(startup[0]),
          founder: startup[1],
          name: startup[2],
          description: startup[3],
          fundingGoal: startup[4],
          totalRaised: startup[5],
          active: startup[6],
          investors,
        });
      }

      setStartups(loadedStartups);

    } catch (error) {
      console.error(
        "Error loading startups:",
        error
      );

      setMessage(
        "Failed to load startups."
      );

    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------
  // Load startups when wallet changes
  // ---------------------------------------------------------

  useEffect(() => {
    loadStartups();
  }, [account]);

  // ---------------------------------------------------------
  // Handle investment amount input
  // ---------------------------------------------------------

  function handleInvestmentChange(
    startupId,
    value
  ) {
    setInvestmentAmounts((previous) => ({
      ...previous,
      [startupId]: value,
    }));
  }

  // ---------------------------------------------------------
  // Invest in startup
  // ---------------------------------------------------------

  async function invest(startup) {
    const amount =
      investmentAmounts[startup.id];

    if (!amount || Number(amount) <= 0) {
      setMessage(
        "Please enter a valid investment amount."
      );
      return;
    }

    if (!startup.active) {
      setMessage(
        "This startup is no longer accepting investments."
      );
      return;
    }

    try {
      setInvestingId(startup.id);
      setMessage("");

      const provider =
        new BrowserProvider(
          window.ethereum
        );

      const signer =
        await provider.getSigner();

      const contract = new Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer
      );

      const investmentInWei =
        parseEther(amount);

      // Send investment transaction
      const tx =
        await contract.invest(
          startup.id,
          {
            value: investmentInWei,
          }
        );

      setMessage(
        "Investment submitted. Waiting for confirmation..."
      );

      await tx.wait();

      setMessage(
        "Investment successful! Your investment is now recorded on the blockchain."
      );

      // Clear investment field
      setInvestmentAmounts(
        (previous) => ({
          ...previous,
          [startup.id]: "",
        })
      );

      // Reload blockchain data
      await loadStartups();

    } catch (error) {
      console.error(
        "Investment error:",
        error
      );

      if (error.code === 4001) {
        setMessage(
          "Transaction rejected in MetaMask."
        );
      } else if (
        error.reason
      ) {
        setMessage(
          error.reason
        );
      } else {
        setMessage(
          "Investment failed."
        );
      }

    } finally {
      setInvestingId(null);
    }
  }

  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------

  return (
    <div className="dashboard-page">

      {/* Navbar */}

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

        <div className="wallet-display">
          {shortenAddress(account)}
        </div>

      </nav>


      {/* Main */}

      <main className="dashboard-main">

        {/* Header */}

        <div className="dashboard-header">

          <div>

            <span className="dashboard-badge">
              INVESTOR DASHBOARD
            </span>

            <h1>
              Discover Startups
            </h1>

            <p>
              Explore startups, track their funding
              and invest in ideas you believe in.
            </p>

          </div>

          <button
            className="back-btn"
            onClick={onBack}
          >
            ← Back
          </button>

        </div>


        {/* Message */}

        {message && (
          <div className="dashboard-message">
            {message}
          </div>
        )}


        {/* Startups */}

        <section className="my-startups">

          <div className="section-title">

            <div>

              <span>
                BLOCKCHAIN STARTUPS
              </span>

              <h2>
                Available Startups
              </h2>

            </div>

            <div className="startup-count">
              {startups.length} Startup
              {startups.length !== 1
                ? "s"
                : ""}
            </div>

          </div>


          {/* Loading */}

          {loading ? (

            <div className="loading-card">
              Loading startups...
            </div>

          ) : startups.length === 0 ? (

            /* No startups */

            <div className="empty-card">

              <div className="empty-icon">
                ◇
              </div>

              <h3>
                No startups available yet
              </h3>

              <p>
                Startups created by founders
                will appear here.
              </p>

            </div>

          ) : (

            /* Startup Grid */

            <div className="startup-grid">

              {startups.map((startup) => {

                const progress =
                  calculateProgress(
                    startup.totalRaised,
                    startup.fundingGoal
                  );

                const goalReached =
                  startup.totalRaised >=
                  startup.fundingGoal;

                return (

                  <div
                    className="startup-card"
                    key={startup.id}
                  >

                    {/* Card Header */}

                    <div className="startup-card-top">

                      <div className="startup-number">
                        #{startup.id}
                      </div>

                      <div
                        className={
                          goalReached
                            ? "status completed"
                            : "status active"
                        }
                      >
                        {goalReached
                          ? "Goal Reached ✓"
                          : "Funding Active"}
                      </div>

                    </div>


                    {/* Startup */}

                    <h3>
                      {startup.name}
                    </h3>

                    <p className="startup-description">
                      {startup.description}
                    </p>


                    {/* Founder */}

                    <div className="founder-info">

                      <span>
                        Founder
                      </span>

                      <strong>
                        {shortenAddress(
                          startup.founder
                        )}
                      </strong>

                    </div>


                    {/* Funding */}

                    <div className="funding-info">

                      <div>

                        <span>
                          Raised
                        </span>

                        <strong>
                          {formatEther(
                            startup.totalRaised
                          )} ETH
                        </strong>

                      </div>

                      <div>

                        <span>
                          Goal
                        </span>

                        <strong>
                          {formatEther(
                            startup.fundingGoal
                          )} ETH
                        </strong>

                      </div>

                    </div>


                    {/* Progress */}

                    <div className="progress-section">

                      <div className="progress-bar">

                        <div
                          className="progress-fill"
                          style={{
                            width: `${progress}%`,
                          }}
                        />

                      </div>

                      <div className="progress-text">

                        <span>
                          {progress.toFixed(0)}%
                          funded
                        </span>

                        {!goalReached && (

                          <span>
                            {formatEther(
                              startup.fundingGoal -
                                startup.totalRaised
                            )}{" "}
                            ETH remaining
                          </span>

                        )}

                      </div>

                    </div>


                    {/* Investors */}

                    <div className="investors-section">

                      <div className="investors-heading">

                        <h4>
                          Investors
                        </h4>

                        <span>
                          {startup.investors.length}
                        </span>

                      </div>


                      {startup.investors.length ===
                      0 ? (

                        <div className="no-investors">
                          No investments yet.
                        </div>

                      ) : (

                        <div className="investor-list">

                          {startup.investors.map(
                            (investment, index) => (

                              <div
                                className="investor-row"
                                key={index}
                              >

                                <span>
                                  {shortenAddress(
                                    investment.address
                                  )}
                                </span>

                                <strong>
                                  {formatEther(
                                    investment.amount
                                  )}{" "}
                                  ETH
                                </strong>

                              </div>

                            )
                          )}

                        </div>

                      )}

                    </div>


                    {/* Investment Area */}

                    {!goalReached && (

                      <div className="investment-area">

                        <label>
                          Invest in this startup
                        </label>

                        <div className="investment-input">

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Enter ETH amount"
                            value={
                              investmentAmounts[
                                startup.id
                              ] || ""
                            }
                            onChange={(e) =>
                              handleInvestmentChange(
                                startup.id,
                                e.target.value
                              )
                            }
                          />

                          <span>
                            ETH
                          </span>

                        </div>


                        <button
                          className="invest-btn"
                          onClick={() =>
                            invest(startup)
                          }
                          disabled={
                            investingId ===
                            startup.id
                          }
                        >
                          {investingId ===
                          startup.id
                            ? "Investing..."
                            : "Invest Now →"}
                        </button>

                      </div>

                    )}


                    {goalReached && (

                      <div className="funding-complete">
                        This startup has reached
                        its funding goal.
                      </div>

                    )}

                  </div>

                );
              })}

            </div>

          )}

        </section>

      </main>


      {/* Footer */}

      <footer>

        <strong>
          StartFund
        </strong>

        <p>
          Blockchain-Based Startup Funding
          and Governance Platform
        </p>

      </footer>

    </div>
  );
}

export default InvestorDashboard;