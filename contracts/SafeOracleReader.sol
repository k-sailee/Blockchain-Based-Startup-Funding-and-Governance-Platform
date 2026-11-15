// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";

contract SafeOracleReader {
    error InvalidFeed();
    error InvalidMaxAge();
    error InvalidPrice();
    error InvalidTimestamp();
    error StalePrice();
    error ConversionOverflow();

    AggregatorV3Interface public immutable feed;
    uint256 public immutable maxAge;
    uint8 public immutable feedDecimals;

    constructor(AggregatorV3Interface _feed, uint256 _maxAge) {
        if (address(_feed) == address(0)) revert InvalidFeed();
        if (_maxAge == 0) revert InvalidMaxAge();
        feed = _feed;
        maxAge = _maxAge;
        feedDecimals = _feed.decimals();
    }

    function readPrice() public view returns (uint256 price, uint8 decimals_) {
        (, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();
        _validate(answer, updatedAt);
        return (uint256(answer), feedDecimals);
    }

    function latestPriceData()
        external
        view
        returns (uint256 price, uint8 decimals_, uint256 updatedAt, string memory description)
    {
        (, int256 answer,, uint256 timestamp,) = feed.latestRoundData();
        _validate(answer, timestamp);
        return (uint256(answer), feedDecimals, timestamp, feed.description());
    }

    function getLatestPrice() external view returns (uint256) {
        (uint256 price,) = readPrice();
        return price;
    }

    /// @notice Returns USD value with 18 decimals for an ETH amount denominated in wei.
    function ethToUsd(uint256 weiAmount) external view returns (uint256) {
        (uint256 price,) = readPrice();
        uint256 scale = 10 ** uint256(feedDecimals);
        if (weiAmount != 0 && price > type(uint256).max / weiAmount) {
            revert ConversionOverflow();
        }
        return (weiAmount * price) / scale;
    }

    function _validate(int256 answer, uint256 updatedAt) internal view {
        if (answer <= 0) revert InvalidPrice();
        if (updatedAt == 0 || updatedAt > block.timestamp) revert InvalidTimestamp();
        if (block.timestamp - updatedAt > maxAge) revert StalePrice();
    }
}
