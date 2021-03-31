// SPDX-License-Identifier: MIT
pragma solidity =0.8.3;

interface IPerpetualProtocol {
    function open(uint256 amount) external;

    function close(uint256 amount) external;
}
