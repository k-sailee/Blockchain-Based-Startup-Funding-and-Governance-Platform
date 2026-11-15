// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IGovernanceVotes {
    function getVotes(address account) external view returns (uint256);
    function getPastVotes(address account, uint256 timepoint) external view returns (uint256);
    function getPastTotalSupply(uint256 timepoint) external view returns (uint256);
}
