// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract AMMPool is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;
    IERC20 public immutable token0;
    IERC20 public immutable token1;
    uint112 private reserve0;
    uint112 private reserve1;
    uint32 public lastUpdate;
    uint256 public constant FEE_BPS = 30;

    event LiquidityAdded(address indexed provider, uint256 amount0, uint256 amount1, uint256 shares);
    event LiquidityRemoved(address indexed provider, uint256 amount0, uint256 amount1, uint256 shares);
    event Swap(address indexed trader, address indexed tokenIn, uint256 amountIn, uint256 amountOut, address indexed to);
    event Sync(uint112 reserve0, uint112 reserve1);

    constructor(IERC20 _token0, IERC20 _token1) ERC20("DEX Pool Share", "DEX-LP") {
        require(address(_token0) != address(_token1), "identical tokens");
        token0 = _token0; token1 = _token1;
    }
    function reserves() external view returns (uint112, uint112) { return (reserve0, reserve1); }
    function getReserves() external view returns (uint112, uint112, uint32) { return (reserve0, reserve1, lastUpdate); }
    function getAmountOut(uint256 amountIn, address tokenIn) public view returns (uint256) {
        require(tokenIn == address(token0) || tokenIn == address(token1), "invalid token");
        (uint256 rin, uint256 rout) = tokenIn == address(token0) ? (reserve0, reserve1) : (reserve1, reserve0);
        require(rin > 0 && rout > 0, "insufficient liquidity");
        uint256 inWithFee = amountIn * (10_000 - FEE_BPS);
        return (inWithFee * rout) / (rin * 10_000 + inWithFee);
    }
    function addLiquidity(uint256 amount0, uint256 amount1, uint256 minShares) external nonReentrant returns (uint256 shares) {
        require(amount0 > 0 && amount1 > 0, "zero amount");
        uint256 supply = totalSupply();
        shares = supply == 0 ? _sqrt(amount0 * amount1) : _min(amount0 * supply / reserve0, amount1 * supply / reserve1);
        require(shares >= minShares && shares > 0, "slippage");
        token0.safeTransferFrom(msg.sender, address(this), amount0);
        token1.safeTransferFrom(msg.sender, address(this), amount1);
        _mint(msg.sender, shares); _sync();
        emit LiquidityAdded(msg.sender, amount0, amount1, shares);
    }
    function removeLiquidity(uint256 shares, uint256 min0, uint256 min1) external nonReentrant returns (uint256 amount0, uint256 amount1) {
        require(shares > 0, "zero shares");
        require(shares <= totalSupply(), "insufficient shares");
        amount0 = shares * reserve0 / totalSupply(); amount1 = shares * reserve1 / totalSupply();
        require(amount0 >= min0 && amount1 >= min1, "slippage");
        _burn(msg.sender, shares);
        token0.safeTransfer(msg.sender, amount0); token1.safeTransfer(msg.sender, amount1); _sync();
        emit LiquidityRemoved(msg.sender, amount0, amount1, shares);
    }
    function swapExactTokensForTokens(address tokenIn, uint256 amountIn, uint256 minOut, address to) public nonReentrant returns (uint256 amountOut) {
        require(amountIn > 0, "zero amount");
        require(to != address(0), "invalid recipient");
        require(tokenIn == address(token0) || tokenIn == address(token1), "invalid token");
        IERC20 input = IERC20(tokenIn);
        IERC20 output = tokenIn == address(token0) ? token1 : token0;
        amountOut = getAmountOut(amountIn, tokenIn);
        require(amountOut >= minOut, "slippage");
        input.safeTransferFrom(msg.sender, address(this), amountIn);
        output.safeTransfer(to, amountOut); _sync();
        emit Swap(msg.sender, tokenIn, amountIn, amountOut, to);
    }
    function swap(uint256 amountIn, uint256 minOut, address tokenIn, address to) external returns (uint256) {
        return swapExactTokensForTokens(tokenIn, amountIn, minOut, to);
    }
    function _sync() internal { reserve0 = uint112(token0.balanceOf(address(this))); reserve1 = uint112(token1.balanceOf(address(this))); lastUpdate = uint32(block.timestamp); emit Sync(reserve0, reserve1); }
    function _min(uint256 a, uint256 b) private pure returns (uint256) { return a < b ? a : b; }
    function _sqrt(uint256 y) private pure returns (uint256 z) { if (y > 3) { z = y; uint256 x = y / 2 + 1; while (x < z) { z = x; x = (y / x + x) / 2; } } else if (y != 0) z = 1; }
}
