// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";

contract MockAggregatorV3 is AggregatorV3Interface {
    uint8 public immutable override decimals;
    string public override description;
    uint80 public roundId;
    int256 public answer;
    uint256 public startedAt;
    uint256 public updatedAt;
    uint80 public answeredInRound;

    constructor(uint8 _decimals, string memory _description, int256 _answer) {
        decimals = _decimals;
        description = _description;
        setAnswer(_answer);
    }

    function setAnswer(int256 _answer) public {
        answer = _answer;
        roundId++;
        startedAt = block.timestamp;
        updatedAt = block.timestamp;
        answeredInRound = roundId;
    }

    function version() external pure override returns (uint256) {
        return 1;
    }

    function getRoundData(uint80 _roundId)
        external
        view
        override
        returns (uint80, int256, uint256, uint256, uint80)
    {
        require(_roundId == roundId, "unknown round");
        return (roundId, answer, startedAt, updatedAt, answeredInRound);
    }

    function setRoundData(int256 _answer, uint256 _updatedAt) external {
        answer = _answer;
        roundId++;
        startedAt = _updatedAt;
        updatedAt = _updatedAt;
        answeredInRound = roundId;
    }

    function latestRoundData()
        external
        view
        override
        returns (uint80, int256, uint256, uint256, uint80)
    {
        return (roundId, answer, startedAt, updatedAt, answeredInRound);
    }
}
