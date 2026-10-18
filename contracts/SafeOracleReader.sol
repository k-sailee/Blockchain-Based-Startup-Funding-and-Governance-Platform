// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPriceFeed { function decimals() external view returns (uint8); function latestRoundData() external view returns (uint80,int256,uint256,uint256,uint80); }
contract SafeOracleReader {
    IPriceFeed public immutable feed;
    uint256 public immutable maxAge;
    constructor(IPriceFeed _feed, uint256 _maxAge) { feed = _feed; maxAge = _maxAge; }
    function readPrice() public view returns (uint256 price, uint8 feedDecimals) {
        (, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();
        require(
            answer > 0 &&
            updatedAt != 0 &&
            updatedAt <= block.timestamp &&
            block.timestamp - updatedAt <= maxAge,
            "stale or invalid oracle"
        );
        return (uint256(answer), feed.decimals());
    }
    function getLatestPrice() external view returns (uint256) { (uint256 price,) = readPrice(); return price; }
}
