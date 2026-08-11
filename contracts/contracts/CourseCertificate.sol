// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ICourseMarket} from "./interfaces/ICourseMarket.sol";

/// @title Course Certificate
/// @notice ERC721-compatible, non-transferable proof of course completion.
contract CourseCertificate is ERC721URIStorage, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant REVOKER_ROLE = keccak256("REVOKER_ROLE");

    ICourseMarket public immutable market;
    uint256 public nextTokenId = 1;
    mapping(uint256 courseId => mapping(address student => uint256 tokenId)) public certificateOf;

    error InvalidAddress();
    error CourseNotPurchased(uint256 courseId, address student);
    error CertificateAlreadyMinted(uint256 courseId, address student);
    error CertificateNotFound(uint256 courseId, address student);
    error CertificateIsNonTransferable();
    error EmptyMetadataURI();
    error EmptyRevocationReason();

    event CertificateMinted(
        uint256 indexed tokenId, uint256 indexed courseId, address indexed student, string metadataURI
    );
    event CertificateRevoked(
        uint256 indexed tokenId, uint256 indexed courseId, address indexed student, string reason
    );

    /// @param courseMarket Course purchase proof contract.
    /// @param admin Initial administrator, minter and revoker.
    constructor(address courseMarket, address admin) ERC721("YD Course Certificate", "YDCERT") {
        if (courseMarket == address(0) || admin == address(0)) revert InvalidAddress();
        market = ICourseMarket(courseMarket);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(REVOKER_ROLE, admin);
    }

    /// @notice Mints one certificate after validating the student's chain purchase.
    function mintCertificate(address student, uint256 courseId, string calldata metadataURI)
        external
        onlyRole(MINTER_ROLE)
        returns (uint256 tokenId)
    {
        if (student == address(0)) revert InvalidAddress();
        if (bytes(metadataURI).length == 0) revert EmptyMetadataURI();
        if (!market.hasPurchased(courseId, student)) revert CourseNotPurchased(courseId, student);
        if (certificateOf[courseId][student] != 0) revert CertificateAlreadyMinted(courseId, student);

        tokenId = nextTokenId++;
        certificateOf[courseId][student] = tokenId;
        _safeMint(student, tokenId);
        _setTokenURI(tokenId, metadataURI);
        emit CertificateMinted(tokenId, courseId, student, metadataURI);
    }

    /// @notice Revokes an incorrectly issued certificate with a public reason.
    function revokeCertificate(uint256 courseId, address student, string calldata reason)
        external
        onlyRole(REVOKER_ROLE)
    {
        if (bytes(reason).length == 0) revert EmptyRevocationReason();
        uint256 tokenId = certificateOf[courseId][student];
        if (tokenId == 0) revert CertificateNotFound(courseId, student);
        delete certificateOf[courseId][student];
        _burn(tokenId);
        emit CertificateRevoked(tokenId, courseId, student, reason);
    }

    /// @dev Allows mint and burn while rejecting transfers between non-zero addresses.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert CertificateIsNonTransferable();
        return super._update(to, tokenId, auth);
    }

    /// @inheritdoc ERC721URIStorage
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
