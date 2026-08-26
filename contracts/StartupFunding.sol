// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract StartupFunding {

    // =========================================================
    // STRUCTS
    // =========================================================

    struct Investment {
        address investor;
        uint256 amount;
    }

    struct Startup {
        uint256 id;
        address founder;
        string name;
        string description;
        uint256 fundingGoal;
        uint256 totalRaised;
        bool active;
        Investment[] investments;
    }


    // =========================================================
    // STATE VARIABLES
    // =========================================================

    uint256 public startupCount;

    mapping(uint256 => Startup) private startups;


    // =========================================================
    // EVENTS
    // =========================================================

    event StartupCreated(
        uint256 indexed startupId,
        address indexed founder,
        string name,
        uint256 fundingGoal
    );

    event InvestmentMade(
        uint256 indexed startupId,
        address indexed investor,
        uint256 amount
    );


    // =========================================================
    // CREATE STARTUP
    // =========================================================

    function createStartup(
        string calldata _name,
        string calldata _description,
        uint256 _fundingGoal
    ) external {

        require(
            bytes(_name).length > 0,
            "Startup name required"
        );

        require(
            _fundingGoal > 0,
            "Funding goal must be greater than zero"
        );

        startupCount++;

        Startup storage startup = startups[startupCount];

        startup.id = startupCount;
        startup.founder = msg.sender;
        startup.name = _name;
        startup.description = _description;
        startup.fundingGoal = _fundingGoal;
        startup.totalRaised = 0;
        startup.active = true;

        emit StartupCreated(
            startupCount,
            msg.sender,
            _name,
            _fundingGoal
        );
    }


    // =========================================================
    // INVEST IN STARTUP
    // =========================================================

    function invest(uint256 _startupId)
        external
        payable
    {
        require(
            _startupId > 0 &&
            _startupId <= startupCount,
            "Startup does not exist"
        );

        require(
            msg.value > 0,
            "Investment must be greater than zero"
        );

        Startup storage startup = startups[_startupId];

        require(
            startup.active,
            "Startup funding is closed"
        );

        require(
            startup.totalRaised + msg.value <= startup.fundingGoal,
            "Investment exceeds funding goal"
        );

        // Record investor and amount
        startup.investments.push(
            Investment({
                investor: msg.sender,
                amount: msg.value
            })
        );

        // Update total raised
        startup.totalRaised += msg.value;

        // Close funding when goal is reached
        if (startup.totalRaised == startup.fundingGoal) {
            startup.active = false;
        }

        emit InvestmentMade(
            _startupId,
            msg.sender,
            msg.value
        );
    }


    // =========================================================
    // GET STARTUP INFORMATION
    // =========================================================

    function getStartup(uint256 _startupId)
        external
        view
        returns (
            uint256 id,
            address founder,
            string memory name,
            string memory description,
            uint256 fundingGoal,
            uint256 totalRaised,
            bool active
        )
    {
        require(
            _startupId > 0 &&
            _startupId <= startupCount,
            "Startup does not exist"
        );

        Startup storage startup = startups[_startupId];

        return (
            startup.id,
            startup.founder,
            startup.name,
            startup.description,
            startup.fundingGoal,
            startup.totalRaised,
            startup.active
        );
    }


    // =========================================================
    // GET NUMBER OF INVESTMENTS
    // =========================================================

    function getInvestmentCount(uint256 _startupId)
        external
        view
        returns (uint256)
    {
        require(
            _startupId > 0 &&
            _startupId <= startupCount,
            "Startup does not exist"
        );

        return startups[_startupId].investments.length;
    }


    // =========================================================
    // GET INDIVIDUAL INVESTMENT
    // =========================================================

    function getInvestment(
        uint256 _startupId,
        uint256 _investmentIndex
    )
        external
        view
        returns (
            address investor,
            uint256 amount
        )
    {
        require(
            _startupId > 0 &&
            _startupId <= startupCount,
            "Startup does not exist"
        );

        require(
            _investmentIndex <
            startups[_startupId].investments.length,
            "Investment does not exist"
        );

        Investment storage investment =
            startups[_startupId].investments[_investmentIndex];

        return (
            investment.investor,
            investment.amount
        );
    }
}