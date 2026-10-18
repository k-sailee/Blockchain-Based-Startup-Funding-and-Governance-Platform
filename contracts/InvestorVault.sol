
 // SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract InvestorVault is ERC4626 {
    constructor(IERC20 assetToken)
        ERC20("StartFund Vault Share", "sfVS")
        ERC4626(assetToken)
    {}
}
