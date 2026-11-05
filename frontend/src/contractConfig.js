import StartupFunding from "./contracts/StartupFunding.json";
import SimpleStaking from "./contracts/SimpleStaking.json";
import MockERC20 from "./contracts/MockERC20.json";

// Startup Funding contract (existing)
export const CONTRACT_ADDRESS = "0x44f45477A347f7d022D4573A3bec275B93c8465d";
export const CONTRACT_ABI = StartupFunding.abi;

// Part 2: Staking and Token contracts
export const STAKING_CONTRACT_ADDRESS = "0x5288b84296995268C5124a7338E4c164A548741A";
export const STAKING_CONTRACT_ABI = SimpleStaking.abi;

export const ABC_TOKEN_ADDRESS = "0xbF2BDcdd43F9996Bdbdfc1262097da9C34d8E428";
export const ABC_TOKEN_ABI = MockERC20.abi;

export const RWD_TOKEN_ADDRESS = "0xc3d9ffb182606078d92e3563AD336911034cDFD8";
export const RWD_TOKEN_ABI = MockERC20.abi;
