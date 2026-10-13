// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title SimpleStaking
 * @notice Protocol token staking mechanism with time-based reward accrual.
 * @dev Educational simulation for DeFi Experiment 5 Part 2.
 */
contract SimpleStaking {
    // =========================================================
    // STATE VARIABLES
    // =========================================================

    address public stakingToken;
    address public rewardToken;
    uint256 public rewardRate; // 0.001 RWD per ABC per second scaled by 1e18 (i.e. 1e15)

    mapping(address => uint256) public stakedBalance;
    mapping(address => uint256) public lastUpdate;
    mapping(address => uint256) public pendingReward;

    uint256 private _locked = 1;

    // =========================================================
    // EVENTS
    // =========================================================

    event Staked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 reward);
    event Unstaked(address indexed user, uint256 amount);

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

        stakingToken = _stakingToken;
        rewardToken = _rewardToken;
        // 0.001 RWD per ABC per second: 0.001 * 1e18 = 1e15
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
     * @notice Stake platform tokens into the contract.
     * @param amount The quantity of staking tokens to deposit.
     */
    function stake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Cannot stake 0");

        stakedBalance[msg.sender] += amount;

        emit Staked(msg.sender, amount);

        _safeTransferFrom(stakingToken, msg.sender, address(this), amount);
    }

    /**
     * @notice Claim all accrued reward tokens without unstaking.
     */
    function claimReward() external nonReentrant updateReward(msg.sender) {
        uint256 reward = pendingReward[msg.sender];
        require(reward > 0, "No rewards to claim");

        uint256 contractRewardBal = IERC20(rewardToken).balanceOf(address(this));
        require(contractRewardBal >= reward, "Insufficient reward token balance in contract");

        pendingReward[msg.sender] = 0;

        emit RewardClaimed(msg.sender, reward);

        _safeTransfer(rewardToken, msg.sender, reward);
    }

    /**
     * @notice Unstake a specific amount of tokens while preserving remaining stake and accrued rewards.
     * @param amount The quantity of staked tokens to withdraw.
     */
    function unstake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Cannot unstake 0");
        require(stakedBalance[msg.sender] >= amount, "Withdrawal exceeds staked balance");

        stakedBalance[msg.sender] -= amount;

        emit Unstaked(msg.sender, amount);

        _safeTransfer(stakingToken, msg.sender, amount);
    }

    /**
     * @notice Withdraw all staked tokens and claim all accrued rewards in a single transaction.
     */
    function exit() external nonReentrant updateReward(msg.sender) {
        uint256 balance = stakedBalance[msg.sender];
        uint256 reward = pendingReward[msg.sender];
        require(balance > 0 || reward > 0, "No staked tokens or rewards to exit");

        if (balance > 0) {
            stakedBalance[msg.sender] = 0;
            emit Unstaked(msg.sender, balance);
            _safeTransfer(stakingToken, msg.sender, balance);
        }

        if (reward > 0) {
            uint256 contractRewardBal = IERC20(rewardToken).balanceOf(address(this));
            require(contractRewardBal >= reward, "Insufficient reward token balance in contract");

            pendingReward[msg.sender] = 0;
            emit RewardClaimed(msg.sender, reward);
            _safeTransfer(rewardToken, msg.sender, reward);
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
