// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ICourseRegistry} from "./interfaces/ICourseRegistry.sol";

/// @title Course Registry
/// @notice Stores only the stable, payment-relevant part of a course on-chain.
contract CourseRegistry is ICourseRegistry, AccessControl, Pausable {
    bytes32 public constant COURSE_MANAGER_ROLE = keccak256("COURSE_MANAGER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    uint16 public constant BPS_DENOMINATOR = 10_000;

    uint256 public courseCount;
    mapping(uint256 courseId => Course course) private courses;

    error CourseNotFound(uint256 courseId);
    error InvalidAddress();
    error InvalidPrice();
    error InvalidRevenueSplit();
    error EmptyMetadataURI();

    event CourseCreated(
        uint256 indexed courseId,
        address indexed teacher,
        address indexed merchant,
        uint256 priceYD,
        string metadataURI
    );
    event CoursePriceUpdated(uint256 indexed courseId, uint256 previousPrice, uint256 newPrice);
    event CourseRevenueSplitUpdated(
        uint256 indexed courseId,
        uint16 teacherShareBps,
        uint16 merchantShareBps,
        uint16 platformShareBps
    );
    event CourseStatusUpdated(uint256 indexed courseId, bool active);
    event CourseMetadataUpdated(uint256 indexed courseId, string metadataURI);

    /// @param admin Initial administrator, course manager and emergency pauser.
    constructor(address admin) {
        if (admin == address(0)) revert InvalidAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(COURSE_MANAGER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    /// @notice Creates a new course with immutable identity and mutable commercial terms.
    function createCourse(
        address teacher,
        address merchant,
        uint128 priceYD,
        uint16 teacherShareBps,
        uint16 merchantShareBps,
        uint16 platformShareBps,
        string calldata metadataURI
    ) external onlyRole(COURSE_MANAGER_ROLE) whenNotPaused returns (uint256 courseId) {
        _validateAddresses(teacher, merchant);
        _validatePrice(priceYD);
        _validateRevenueSplit(teacherShareBps, merchantShareBps, platformShareBps);
        if (bytes(metadataURI).length == 0) revert EmptyMetadataURI();

        courseId = ++courseCount;
        courses[courseId] = Course({
            teacher: teacher,
            merchant: merchant,
            priceYD: priceYD,
            teacherShareBps: teacherShareBps,
            merchantShareBps: merchantShareBps,
            platformShareBps: platformShareBps,
            active: true,
            metadataURI: metadataURI
        });

        emit CourseCreated(courseId, teacher, merchant, priceYD, metadataURI);
    }

    /// @inheritdoc ICourseRegistry
    function getCourse(uint256 courseId) external view returns (Course memory) {
        _requireCourse(courseId);
        return courses[courseId];
    }

    /// @notice Updates the price used by future purchases.
    function updatePrice(uint256 courseId, uint128 newPriceYD) external onlyRole(COURSE_MANAGER_ROLE) {
        _requireCourse(courseId);
        _validatePrice(newPriceYD);
        uint256 previousPrice = courses[courseId].priceYD;
        courses[courseId].priceYD = newPriceYD;
        emit CoursePriceUpdated(courseId, previousPrice, newPriceYD);
    }

    /// @notice Updates the revenue split for future purchases.
    function updateRevenueSplit(
        uint256 courseId,
        uint16 teacherShareBps,
        uint16 merchantShareBps,
        uint16 platformShareBps
    ) external onlyRole(COURSE_MANAGER_ROLE) {
        _requireCourse(courseId);
        _validateRevenueSplit(teacherShareBps, merchantShareBps, platformShareBps);
        Course storage course = courses[courseId];
        course.teacherShareBps = teacherShareBps;
        course.merchantShareBps = merchantShareBps;
        course.platformShareBps = platformShareBps;
        emit CourseRevenueSplitUpdated(courseId, teacherShareBps, merchantShareBps, platformShareBps);
    }

    /// @notice Enables or disables future purchases of a course.
    function setCourseActive(uint256 courseId, bool active) external onlyRole(COURSE_MANAGER_ROLE) {
        _requireCourse(courseId);
        courses[courseId].active = active;
        emit CourseStatusUpdated(courseId, active);
    }

    /// @notice Changes the public metadata pointer for a course.
    function updateMetadataURI(uint256 courseId, string calldata metadataURI)
        external
        onlyRole(COURSE_MANAGER_ROLE)
    {
        _requireCourse(courseId);
        if (bytes(metadataURI).length == 0) revert EmptyMetadataURI();
        courses[courseId].metadataURI = metadataURI;
        emit CourseMetadataUpdated(courseId, metadataURI);
    }

    /// @notice Pauses course creation and marketplace purchases that consult this registry.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Resumes course creation.
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _requireCourse(uint256 courseId) private view {
        if (courseId == 0 || courseId > courseCount) revert CourseNotFound(courseId);
    }

    function _validateAddresses(address teacher, address merchant) private pure {
        if (teacher == address(0) || merchant == address(0)) revert InvalidAddress();
    }

    function _validatePrice(uint128 priceYD) private pure {
        if (priceYD == 0) revert InvalidPrice();
    }

    function _validateRevenueSplit(uint16 teacher, uint16 merchant, uint16 platform) private pure {
        if (uint256(teacher) + merchant + platform != BPS_DENOMINATOR) revert InvalidRevenueSplit();
    }
}
