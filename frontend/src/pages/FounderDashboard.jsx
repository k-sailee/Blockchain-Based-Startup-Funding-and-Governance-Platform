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

function FounderDashboard({ account, onBack }) {
  const [startups, setStartups] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showCreateForm, setShowCreateForm] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fundingGoal, setFundingGoal] = useState("");

  const [creating, setCreating] = useState(false);
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
    if (goal === 0n) return 0;

    const progress =
      (Number(raised) / Number(goal)) * 100;

    return Math.min(progress, 100);
  }

  // ---------------------------------------------------------
  // Load startups created by connected founder
  // ---------------------------------------------------------

  async function loadStartups() {
    if (!window.ethereum || !account) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const provider = new BrowserProvider(
        window.ethereum
      );

      const contract = new Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        provider
      );

      const count = await contract.startupCount();

      const loadedStartups = [];

      for (let i = 1; i <= Number(count); i++) {
        const startup = await contract.getStartup(i);

        const founder = startup[1];

        // Only show startups created by this wallet
        if (
          founder.toLowerCase() !==
          account.toLowerCase()
        ) {
          continue;
        }

        // Get number of investments
        const investmentCount =
          await contract.getInvestmentCount(i);

        const investors = [];

        // Get each investment
        for (
          let j = 0;
          j < Number(investmentCount);
          j++
        ) {
          const investment =
            await contract.getInvestment(i, j);

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

  // Load startups when wallet changes
  useEffect(() => {
    loadStartups();
  }, [account]);

  // ---------------------------------------------------------
  // Create a new startup
  // ---------------------------------------------------------

  async function createStartup() {
    if (
      !name.trim() ||
      !description.trim() ||
      !fundingGoal
    ) {
      setMessage(
        "Please fill in all fields."
      );
      return;
    }

    if (Number(fundingGoal) <= 0) {
      setMessage(
        "Funding goal must be greater than zero."
      );
      return;
    }

    try {
      setCreating(true);
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

      // Convert ETH to Wei
      const goalInWei =
        parseEther(fundingGoal);

      // Send transaction
      const tx =
        await contract.createStartup(
          name.trim(),
          description.trim(),
          goalInWei
        );

      setMessage(
        "Transaction submitted. Waiting for confirmation..."
      );

      await tx.wait();

      setMessage(
        "Startup created successfully on the blockchain!"
      );

      // Clear form
      setName("");
      setDescription("");
      setFundingGoal("");

      // Hide form
      setShowCreateForm(false);

      // Reload startups
      await loadStartups();
    } catch (error) {
      console.error(
        "Create startup error:",
        error
      );

      if (error.code === 4001) {
        setMessage(
          "Transaction rejected in MetaMask."
        );
      } else {
        setMessage(
          "Failed to create startup."
        );
      }
    } finally {
      setCreating(false);
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


      {/* Main Dashboard */}

      <main className="dashboard-main">

        {/* Header */}

        <div className="dashboard-header">

          <div>

            <span className="dashboard-badge">
              FOUNDER DASHBOARD
            </span>

            <h1>
              Your Startups
            </h1>

            <p>
              Manage your startups, track funding
              and see your investors.
            </p>

          </div>

          <button
            className="back-btn"
            onClick={onBack}
          >
            ← Back
          </button>

        </div>


        {/* Create Startup Button */}

        {!showCreateForm && (
          <button
            className="create-startup-btn"
            onClick={() =>
              setShowCreateForm(true)
            }
          >
            + Create New Startup
          </button>
        )}


        {/* Create Startup Form */}

        {showCreateForm && (

          <section className="create-card">

            <div className="create-card-header">

              <div>

                <span>
                  NEW STARTUP
                </span>

                <h2>
                  Create Your Startup
                </h2>

                <p>
                  Register your startup on the
                  blockchain.
                </p>

              </div>

              <button
                className="close-form-btn"
                onClick={() =>
                  setShowCreateForm(false)
                }
              >
                ×
              </button>

            </div>


            {/* Startup Name */}

            <div className="form-group">

              <label>
                Startup Name
              </label>

              <input
                type="text"
                placeholder="Enter startup name"
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
              />

            </div>


            {/* Description */}

            <div className="form-group">

              <label>
                Description
              </label>

              <textarea
                placeholder="Describe your startup idea..."
                value={description}
                onChange={(e) =>
                  setDescription(
                    e.target.value
                  )
                }
              />

            </div>


            {/* Funding Goal */}

            <div className="form-group">

              <label>
                Funding Goal
              </label>

              <div className="eth-input">

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Example: 10"
                  value={fundingGoal}
                  onChange={(e) =>
                    setFundingGoal(
                      e.target.value
                    )
                  }
                />

                <span>
                  ETH
                </span>

              </div>

            </div>


            {/* Submit */}

            <button
              className="submit-startup-btn"
              onClick={createStartup}
              disabled={creating}
            >
              {creating
                ? "Creating Startup..."
                : "Create Startup →"}
            </button>

          </section>

        )}


        {/* Status Message */}

        {message && (
          <div className="dashboard-message">
            {message}
          </div>
        )}


        {/* My Startups */}

        <section className="my-startups">

          <div className="section-title">

            <div>

              <span>
                YOUR BLOCKCHAIN ACTIVITY
              </span>

              <h2>
                My Startups
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
              Loading your startups...
            </div>

          ) : startups.length === 0 ? (

            /* Empty State */

            <div className="empty-card">

              <div className="empty-icon">
                ◈
              </div>

              <h3>
                You haven't created a startup yet
              </h3>

              <p>
                Create your first startup and
                start raising funds from investors.
              </p>

              <button
                onClick={() =>
                  setShowCreateForm(true)
                }
              >
                Create Your First Startup →
              </button>

            </div>

          ) : (

            /* Startup Cards */

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


                    {/* Startup Information */}

                    <h3>
                      {startup.name}
                    </h3>

                    <p className="startup-description">
                      {startup.description}
                    </p>


                    {/* Funding Information */}

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
                          Funding Goal
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

export default FounderDashboard;