// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title SimpleYieldFarm
 * @notice Yield farming mechanism simulating LP token staking with time-based reward accrual.
 * @dev Educational simulation for DeFi Experiment 5 Part 1.
 */
contract SimpleYieldFarm {
    // =========================================================
    // STATE VARIABLES
    // =========================================================

    address public stakingToken;
    address public rewardToken;
    uint256 public rewardRate; // 0.001 RWD per LPT per second scaled by 1e18 (i.e. 1e15)

    mapping(address => uint256) public stakedBalance;
    mapping(address => uint256) public lastUpdate;
    mapping(address => uint256) public pendingReward;

    uint256 private _locked = 1;

    // =========================================================
    // EVENTS
    // =========================================================

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);

    // =========================================================
    // MODIFIERS
    // =========================================================

    modifier nonReentrant() {
        require(_locked == 1, "ReentrancyGuard: reentrant call");
        _locked = 2;
        _;
        _locked = 1;
    }

    modifier updateReward(address user) {
        pendingReward[user] = earned(user);
        lastUpdate[user] = block.timestamp;
        _;
    }

    // =========================================================
    // CONSTRUCTOR
    // =========================================================

    constructor(address _stakingToken, address _rewardToken) {
        require(_stakingToken != address(0), "Invalid staking token address");
        require(_rewardToken != address(0), "Invalid reward token address");
        require(_stakingToken != _rewardToken, "Identical token addresses");

        stakingToken = _stakingToken;
        rewardToken = _rewardToken;
        // 0.001 RWD per LPT per second: 0.001 * 1e18 = 1e15
        rewardRate = 1e15;
    }

    // =========================================================
    // VIEW FUNCTIONS
    // =========================================================

    /**
     * @notice Calculate total earned rewards accumulated by `user`.
     * @dev Reward formula: Reward = Staked Amount * Reward Rate * Elapsed Time / 1e18
     */
    function earned(address user) public view returns (uint256) {
        uint256 newlyAccrued = 0;
        if (stakedBalance[user] > 0 && block.timestamp > lastUpdate[user]) {
            uint256 elapsed = block.timestamp - lastUpdate[user];
            newlyAccrued = (stakedBalance[user] * rewardRate * elapsed) / 1e18;
        }
        return pendingReward[user] + newlyAccrued;
    }

    // =========================================================
    // MUTATIVE FUNCTIONS
    // =========================================================

    /**
     * @notice Stake LP tokens into the farm.
     * @param amount The quantity of staking tokens to deposit.
     */
    function stake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Cannot stake 0");

        stakedBalance[msg.sender] += amount;

        emit Staked(msg.sender, amount);

        _safeTransferFrom(stakingToken, msg.sender, address(this), amount);
    }

    /**
     * @notice Harvest accrued reward tokens without unstaking.
     */
    function harvest() external nonReentrant updateReward(msg.sender) {
        uint256 reward = pendingReward[msg.sender];
        require(reward > 0, "No rewards to harvest");

        uint256 farmRewardBal = IERC20(rewardToken).balanceOf(address(this));
        require(farmRewardBal >= reward, "Insufficient reward token balance in farm");

        pendingReward[msg.sender] = 0;

        emit RewardPaid(msg.sender, reward);

        _safeTransfer(rewardToken, msg.sender, reward);
    }

    /**
     * @notice Withdraw a specific amount of LP tokens while preserving remaining stake and accrued rewards.
     * @param amount The quantity of staked LP tokens to withdraw.
     */
    function withdraw(uint256 amount) external nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Cannot withdraw 0");
        require(stakedBalance[msg.sender] >= amount, "Withdrawal exceeds staked balance");

        stakedBalance[msg.sender] -= amount;

        emit Withdrawn(msg.sender, amount);

        _safeTransfer(stakingToken, msg.sender, amount);
    }

    /**
     * @notice Withdraw all staked LP tokens and harvest all accrued rewards in a single transaction.
     */
    function exit() external nonReentrant updateReward(msg.sender) {
        uint256 balance = stakedBalance[msg.sender];
        uint256 reward = pendingReward[msg.sender];
        require(balance > 0 || reward > 0, "No staked tokens or rewards to exit");

        if (reward > 0) {
            uint256 farmRewardBal = IERC20(rewardToken).balanceOf(address(this));
            require(farmRewardBal >= reward, "Insufficient reward token balance in farm");

            pendingReward[msg.sender] = 0;
            emit RewardPaid(msg.sender, reward);
            _safeTransfer(rewardToken, msg.sender, reward);
        }

        if (balance > 0) {
            stakedBalance[msg.sender] = 0;
            emit Withdrawn(msg.sender, balance);
            _safeTransfer(stakingToken, msg.sender, balance);
        }
    }

    // =========================================================
    // INTERNAL HELPERS
    // =========================================================

    function _safeTransfer(address token, address to, uint256 amount) internal {
        bool success = IERC20(token).transfer(to, amount);
        require(success, "Token transfer failed");
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        bool success = IERC20(token).transferFrom(from, to, amount);
        require(success, "Token transferFrom failed");
    }
}
