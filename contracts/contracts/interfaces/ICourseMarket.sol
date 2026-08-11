// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title ICourseMarket
/// @notice Purchase proof interface consumed by the certificate contract.
interface ICourseMarket {
    /// @notice Returns whether a student bought a course.
    function hasPurchased(uint256 courseId, address student) external view returns (bool);
}
