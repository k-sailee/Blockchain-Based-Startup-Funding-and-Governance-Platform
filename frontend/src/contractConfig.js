import StartupFunding from "./contracts/StartupFunding.json";
import SimpleStaking from "./contracts/SimpleStaking.json";
import MockERC20 from "./contracts/MockERC20.json";

// Startup Funding contract (existing)
export const CONTRACT_ADDRESS = "0xB1609949297FdD431aC5a7cBF73e33BAdC42dD80";
export const CONTRACT_ABI = StartupFunding.abi;

// Part 2: Staking and Token contracts
export const STAKING_CONTRACT_ADDRESS = "0x6dD510eCb840bDbB707eACa9dC937ef305d12aB3";
export const STAKING_CONTRACT_ABI = SimpleStaking.abi;

export const ABC_TOKEN_ADDRESS = "0x6039b29433470546aa48A957217aAee90b2fFEE8";
export const ABC_TOKEN_ABI = MockERC20.abi;

export const RWD_TOKEN_ADDRESS = "0x1516F80381B478202c322EeAD752E16870Ed9dae";
export const RWD_TOKEN_ABI = MockERC20.abi;
