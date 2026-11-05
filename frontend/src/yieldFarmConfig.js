import SimpleYieldFarm from "./contracts/SimpleYieldFarm.json";
import MockERC20 from "./contracts/MockERC20.json";

// DeFi Part 1: Yield Farming Configuration
export const CHAIN_ID = 1337;
export const RPC_URL = "http://127.0.0.1:7545";

export const YIELD_FARM_CONTRACT_ADDRESS = "0x63Ba4726E2AaD59c162764ff767B8Ad2d7e60b2a";
export const YIELD_FARM_CONTRACT_ABI = SimpleYieldFarm.abi;

export const LPT_TOKEN_ADDRESS = "0xE18a71D0478e3291Bf085813dFc9507C1aBD49F3";
export const LPT_TOKEN_ABI = MockERC20.abi;

export const RWD_TOKEN_ADDRESS = "0x284a0d73B4f7eEc244961bAC719eE6EFf7f20D3E";
export const RWD_TOKEN_ABI = MockERC20.abi;
