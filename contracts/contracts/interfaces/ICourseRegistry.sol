// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title ICourseRegistry
/// @notice Read interface consumed by the course marketplace.
interface ICourseRegistry {
    struct Course {
        address teacher;
        address merchant;
        uint128 priceYD;
        uint16 teacherShareBps;
        uint16 merchantShareBps;
        uint16 platformShareBps;
        bool active;
        string metadataURI;
    }

    /// @notice Returns the current on-chain terms for a course.
    /// @param courseId The chain course identifier.
    function getCourse(uint256 courseId) external view returns (Course memory);
}
