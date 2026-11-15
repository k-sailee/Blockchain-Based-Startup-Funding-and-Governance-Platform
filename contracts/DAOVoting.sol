// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IGovernanceVotes} from "./interfaces/IGovernanceVotes.sol";

/// @notice Snapshot based, token weighted governance for the StartFund MVP.
contract DAOVoting {
    uint256 public constant QUORUM_PERCENT = 4;
    uint256 public constant MINIMUM_QUORUM = 40 ether;
    uint256 public constant PROPOSAL_THRESHOLD = 50 ether;
    uint256 public constant VOTING_PERIOD = 5;

    enum ProposalState { Active, Defeated, Succeeded }

    struct Proposal {
        uint256 id;
        string title;
        string description;
        string category;
        uint256 startupId;
        uint256 fundingAmount;
        address proposer;
        uint256 snapshotBlock;
        uint256 endBlock;
        uint256 createdAt;
        uint256 forVotes;
        uint256 againstVotes;
    }

    IGovernanceVotes public immutable token;
    Proposal[] private proposals;
    mapping(uint256 => mapping(address => bool)) private voted;

    error InvalidToken();
    error ProposalThresholdNotMet();
    error ProposalDoesNotExist();
    error VotingNotStarted();
    error VotingClosed();
    error AlreadyVoted();
    error NoVotingPower();
    error InvalidProposal();

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        uint256 indexed startupId,
        uint256 endBlock
    );
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight);

    constructor(address tokenAddress) {
        if (tokenAddress == address(0)) revert InvalidToken();
        token = IGovernanceVotes(tokenAddress);
    }

    function propose(string calldata description) external returns (uint256) {
        if (bytes(description).length == 0) revert InvalidProposal();
        return _createProposal(description, description, "Academic", 0, 0);
    }

    function proposeFunding(
        uint256 startupId,
        uint256 fundingAmount,
        string calldata title,
        string calldata description
    ) external returns (uint256) {
        if (startupId == 0 || fundingAmount == 0 || bytes(title).length == 0 || bytes(description).length == 0) {
            revert InvalidProposal();
        }
        return _createProposal(title, description, "StartupFunding", startupId, fundingAmount);
    }

    function _createProposal(
        string memory title,
        string memory description,
        string memory category,
        uint256 startupId,
        uint256 fundingAmount
    ) internal returns (uint256 id) {
        if (token.getVotes(msg.sender) < PROPOSAL_THRESHOLD) revert ProposalThresholdNotMet();
        uint256 currentBlock = block.number;
        uint256 snapshot = currentBlock - 1;
        id = proposals.length;
        uint256 endBlock = currentBlock + VOTING_PERIOD;
        proposals.push(Proposal({
            id: id,
            title: title,
            description: description,
            category: category,
            startupId: startupId,
            fundingAmount: fundingAmount,
            proposer: msg.sender,
            snapshotBlock: snapshot,
            endBlock: endBlock,
            createdAt: block.timestamp,
            forVotes: 0,
            againstVotes: 0
        }));
        emit ProposalCreated(id, msg.sender, startupId, endBlock);
    }

    function castVote(uint256 proposalId, bool support) external {
        if (proposalId >= proposals.length) revert ProposalDoesNotExist();
        Proposal storage proposal = proposals[proposalId];
        if (block.number <= proposal.snapshotBlock) revert VotingNotStarted();
        if (block.number > proposal.endBlock) revert VotingClosed();
        if (voted[proposalId][msg.sender]) revert AlreadyVoted();
        uint256 weight = token.getPastVotes(msg.sender, proposal.snapshotBlock);
        if (weight == 0) revert NoVotingPower();
        voted[proposalId][msg.sender] = true;
        if (support) proposal.forVotes += weight;
        else proposal.againstVotes += weight;
        emit VoteCast(proposalId, msg.sender, support, weight);
    }

    function state(uint256 proposalId) public view returns (uint8) {
        if (proposalId >= proposals.length) revert ProposalDoesNotExist();
        Proposal storage p = proposals[proposalId];
        if (block.number <= p.endBlock) return uint8(ProposalState.Active);
        uint256 quorum = getQuorum();
        return (p.forVotes + p.againstVotes >= quorum && p.forVotes > p.againstVotes)
            ? uint8(ProposalState.Succeeded)
            : uint8(ProposalState.Defeated);
    }

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        if (proposalId >= proposals.length) revert ProposalDoesNotExist();
        return proposals[proposalId];
    }

    function getProposalVotes(uint256 proposalId) external view returns (uint256 againstVotes, uint256 forVotes) {
        if (proposalId >= proposals.length) revert ProposalDoesNotExist();
        Proposal storage p = proposals[proposalId];
        return (p.againstVotes, p.forVotes);
    }

    function hasVoted(uint256 proposalId, address voter) external view returns (bool) {
        if (proposalId >= proposals.length) revert ProposalDoesNotExist();
        return voted[proposalId][voter];
    }


    function getProposalCount() external view returns (uint256) { return proposals.length; }
    function getProposalThreshold() external pure returns (uint256) { return PROPOSAL_THRESHOLD; }
    function getQuorum() public view returns (uint256) {
        uint256 supply = token.getPastTotalSupply(block.number - 1);
        uint256 calculated = supply * QUORUM_PERCENT / 100;
        return calculated < MINIMUM_QUORUM ? MINIMUM_QUORUM : calculated;
    }
    function getVotingPeriod() external pure returns (uint256) { return VOTING_PERIOD; }
}
