import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const DEFAULT_ADMIN = "0x934124d582dd6618309b0905b4DE2631A2892EEe";
const DEFAULT_PLATFORM_TREASURY = "0x934124d582dd6618309b0905b4DE2631A2892EEe";

export default buildModule("YDUniversityModule", (m) => {
  const admin = m.getParameter("admin", DEFAULT_ADMIN);
  const platformTreasury = m.getParameter("platformTreasury", DEFAULT_PLATFORM_TREASURY);

  const ydToken = m.contract("YDToken", [admin]);
  const courseRegistry = m.contract("CourseRegistry", [admin]);
  const courseMarket = m.contract("CourseMarket", [
    ydToken,
    courseRegistry,
    platformTreasury,
    admin,
  ]);
  const courseCertificate = m.contract("CourseCertificate", [courseMarket, admin]);

  return { ydToken, courseRegistry, courseMarket, courseCertificate };
});
