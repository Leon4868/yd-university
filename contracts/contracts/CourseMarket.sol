// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ICourseMarket} from "./interfaces/ICourseMarket.sol";
import {ICourseRegistry} from "./interfaces/ICourseRegistry.sol";

/// @title Course Market
/// @notice Buys courses with YD and records pull-payment revenue for each recipient.
contract CourseMarket is ICourseMarket, AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    uint256 private constant BPS_DENOMINATOR = 10_000;

    IERC20 public immutable ydToken;
    ICourseRegistry public immutable registry;
    address public immutable platformTreasury;

    mapping(uint256 courseId => mapping(address student => bool purchased)) private purchases;
    mapping(uint256 courseId => mapping(address student => uint256 price)) public paidPrice;
    mapping(address account => uint256 amount) public pendingWithdrawals;

    error InvalidAddress();
    error CourseInactive(uint256 courseId);
    error AlreadyPurchased(uint256 courseId, address student);
    error PriceExceedsMaximum(uint256 currentPrice, uint256 maxPrice);
    error NothingToWithdraw();

    event CoursePurchased(uint256 indexed courseId, address indexed student, uint256 paidPrice);
    event RevenueAllocated(
        uint256 indexed courseId,
        address indexed teacher,
        address indexed merchant,
        uint256 teacherAmount,
        uint256 merchantAmount,
        uint256 platformAmount
    );
    event RevenueWithdrawn(address indexed account, uint256 amount);

    /// @param token YD token address.
    /// @param courseRegistry Registry containing current course terms.
    /// @param platform Address receiving the platform share.
    /// @param admin Initial administrator and pauser.
    constructor(address token, address courseRegistry, address platform, address admin) {
        if (
            token == address(0) || courseRegistry == address(0) || platform == address(0) || admin == address(0)
        ) revert InvalidAddress();
        ydToken = IERC20(token);
        registry = ICourseRegistry(courseRegistry);
        platformTreasury = platform;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    /// @notice Purchases a course for msg.sender using its current registry price.
    /// @param courseId The course being purchased.
    /// @param maxPrice Highest price accepted by the student, protecting against price changes.
    function buy(uint256 courseId, uint256 maxPrice) external whenNotPaused nonReentrant {
        ICourseRegistry.Course memory course = registry.getCourse(courseId);
        if (!course.active) revert CourseInactive(courseId);
        if (purchases[courseId][msg.sender]) revert AlreadyPurchased(courseId, msg.sender);
        if (course.priceYD > maxPrice) revert PriceExceedsMaximum(course.priceYD, maxPrice);

        purchases[courseId][msg.sender] = true;
        paidPrice[courseId][msg.sender] = course.priceYD;

        uint256 teacherAmount = (uint256(course.priceYD) * course.teacherShareBps) / BPS_DENOMINATOR;
        uint256 merchantAmount = (uint256(course.priceYD) * course.merchantShareBps) / BPS_DENOMINATOR;
        uint256 platformAmount = uint256(course.priceYD) - teacherAmount - merchantAmount;

        pendingWithdrawals[course.teacher] += teacherAmount;
        pendingWithdrawals[course.merchant] += merchantAmount;
        pendingWithdrawals[platformTreasury] += platformAmount;

        ydToken.safeTransferFrom(msg.sender, address(this), course.priceYD);

        emit CoursePurchased(courseId, msg.sender, course.priceYD);
        emit RevenueAllocated(
            courseId,
            course.teacher,
            course.merchant,
            teacherAmount,
            merchantAmount,
            platformAmount
        );
    }

    /// @inheritdoc ICourseMarket
    function hasPurchased(uint256 courseId, address student) external view returns (bool) {
        return purchases[courseId][student];
    }

    /// @notice Withdraws all YD revenue currently allocated to msg.sender.
    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        pendingWithdrawals[msg.sender] = 0;
        ydToken.safeTransfer(msg.sender, amount);
        emit RevenueWithdrawn(msg.sender, amount);
    }

    /// @notice Pauses new purchases without blocking withdrawals.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Resumes new purchases.
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
