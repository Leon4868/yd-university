// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ICourseCertificate} from "./interfaces/ICourseCertificate.sol";

/// @title Completion Receiver
/// @notice Replay-protected boundary between a Chainlink CRE forwarder and certificate minting.
contract CompletionReceiver is AccessControl {
    ICourseCertificate public immutable certificate;
    address public forwarder;
    mapping(bytes32 completionId => bool consumed) public consumedReports;

    error InvalidAddress();
    error UnauthorizedForwarder(address caller);
    error InvalidCompletionId();
    error CompletionAlreadyConsumed(bytes32 completionId);

    event ForwarderUpdated(address indexed previousForwarder, address indexed newForwarder);
    event CompletionConsumed(
        bytes32 indexed completionId, uint256 indexed courseId, address indexed student, uint256 tokenId
    );

    /// @param certificateContract Course certificate contract.
    /// @param creForwarder Initial authorized CRE forwarder.
    /// @param admin Initial administrator.
    constructor(address certificateContract, address creForwarder, address admin) {
        if (certificateContract == address(0) || creForwarder == address(0) || admin == address(0)) {
            revert InvalidAddress();
        }
        certificate = ICourseCertificate(certificateContract);
        forwarder = creForwarder;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Replaces the CRE forwarder after an explicit admin action.
    function setForwarder(address newForwarder) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newForwarder == address(0)) revert InvalidAddress();
        address previousForwarder = forwarder;
        forwarder = newForwarder;
        emit ForwarderUpdated(previousForwarder, newForwarder);
    }

    /// @notice Consumes a unique completion report and mints its certificate.
    /// @dev The concrete CRE report decoding adapter will call this normalized function.
    function onCompletionReport(
        bytes32 completionId,
        address student,
        uint256 courseId,
        string calldata metadataURI
    ) external returns (uint256 tokenId) {
        if (msg.sender != forwarder) revert UnauthorizedForwarder(msg.sender);
        if (completionId == bytes32(0)) revert InvalidCompletionId();
        if (consumedReports[completionId]) revert CompletionAlreadyConsumed(completionId);

        consumedReports[completionId] = true;
        tokenId = certificate.mintCertificate(student, courseId, metadataURI);
        emit CompletionConsumed(completionId, courseId, student, tokenId);
    }
}
