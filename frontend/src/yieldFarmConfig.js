import SimpleYieldFarm from "./contracts/SimpleYieldFarm.json";
import MockERC20 from "./contracts/MockERC20.json";

// DeFi Part 1: Yield Farming Configuration
export const CHAIN_ID = 1337;
export const RPC_URL = "http://127.0.0.1:7545";

export const YIELD_FARM_CONTRACT_ADDRESS = "0xC6009E2c01709EaEA50d8B11E5c8c4992EF3A5B7";
export const YIELD_FARM_CONTRACT_ABI = SimpleYieldFarm.abi;

export const LPT_TOKEN_ADDRESS = "0xC985c74f7d4078BF7e21225586588F2655c32F60";
export const LPT_TOKEN_ABI = MockERC20.abi;

export const RWD_TOKEN_ADDRESS = "0x94B10AEE2365d4d037beCEdAe953Df5024EBD321";
export const RWD_TOKEN_ABI = MockERC20.abi;
