// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract MockETHUSDOracle is Ownable {
    int256 private price;
    uint8 public constant decimals = 8;
    uint80 public roundId;
    uint256 public updatedAt;
    event PriceUpdated(int256 price, uint256 timestamp);
    constructor(int256 initialPrice) Ownable(msg.sender) { _setPrice(initialPrice); }
    function setPrice(int256 newPrice) external onlyOwner { _setPrice(newPrice); }
    function _setPrice(int256 newPrice) internal {
        require(newPrice > 0, "invalid price");
        price = newPrice;
        roundId++;
        updatedAt = block.timestamp;
        emit PriceUpdated(newPrice, updatedAt);
    }
    function description() external pure returns (string memory) { return "Local simulated ETH/USD price feed"; }
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) { return (roundId, price, updatedAt, updatedAt, roundId); }
    function getPrice() external view returns (int256) { return price; }
}
