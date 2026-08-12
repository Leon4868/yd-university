import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { keccak256, toBytes } from "viem";

const DEFAULT_LOCAL_ADMIN = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const MINTER_ROLE = keccak256(toBytes("MINTER_ROLE"));

export default buildModule("YDUniversityModule", (m) => {
  const admin = m.getParameter("admin", DEFAULT_LOCAL_ADMIN);
  const platformTreasury = m.getParameter("platformTreasury", DEFAULT_LOCAL_ADMIN);
  const creForwarder = m.getParameter("creForwarder", DEFAULT_LOCAL_ADMIN);

  const ydToken = m.contract("YDToken", [admin]);
  const courseRegistry = m.contract("CourseRegistry", [admin]);
  const courseMarket = m.contract("CourseMarket", [
    ydToken,
    courseRegistry,
    platformTreasury,
    admin,
  ]);
  const courseCertificate = m.contract("CourseCertificate", [courseMarket, admin]);
  const completionReceiver = m.contract("CompletionReceiver", [
    courseCertificate,
    creForwarder,
    admin,
  ]);

  m.call(courseCertificate, "grantRole", [MINTER_ROLE, completionReceiver]);

  return {
    ydToken,
    courseRegistry,
    courseMarket,
    courseCertificate,
    completionReceiver,
  };
});
