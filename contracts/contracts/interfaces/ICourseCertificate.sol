// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title ICourseCertificate
/// @notice Mint interface consumed by the completion report receiver.
interface ICourseCertificate {
    /// @notice Mints one certificate for a completed purchased course.
    function mintCertificate(address student, uint256 courseId, string calldata metadataURI)
        external
        returns (uint256 tokenId);
}
