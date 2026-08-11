// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title YD Token
/// @notice Fixed-supply utility token used to buy YD University courses.
contract YDToken is ERC20 {
    uint256 public constant MAX_SUPPLY = 100_000 ether;

    error ZeroTreasury();

    /// @param treasury Address receiving the complete fixed supply at deployment.
    constructor(address treasury) ERC20("YD Token", "YD") {
        if (treasury == address(0)) revert ZeroTreasury();
        _mint(treasury, MAX_SUPPLY);
    }
}
