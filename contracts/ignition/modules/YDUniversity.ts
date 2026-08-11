import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("YDUniversityModule", (m) => {
  const admin = m.getAccount(0);
  const platformTreasury = m.getAccount(1);

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
