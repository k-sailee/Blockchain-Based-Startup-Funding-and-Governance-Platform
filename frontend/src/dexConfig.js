import SafeOracleReader from "./contracts/SafeOracleReader.json";
import MockETHUSDOracle from "./contracts/MockETHUSDOracle.json";
export const DEX_CONFIG = {
  "chainId": 1337,
  "deployer": "0x9fe235Ad9586C81EB5B8ec505d0bce871b096Bc3",
  "WETH9": "0x2b954D5b9b9a62e1252f83f938255A948db8EAFA",
  "MockUSDC": "0xc7e795C10f576a9b2615C30f8Ea1FB0A89B3fee5",
  "AMMPool": "0x687f5F7FDE2F225C9D350Cd666a3461968151778",
  "MockETHUSDOracle": "0x3e014816C849aBD0ddf4f2D00cF4767Eb6BA0fa0",
  "SafeOracleReader": "0x98B084740438068F5c157e00D9c292033816E300"
};
export const SAFE_ORACLE_ABI = SafeOracleReader.abi;
export const MOCK_ORACLE_ABI = MockETHUSDOracle.abi;
