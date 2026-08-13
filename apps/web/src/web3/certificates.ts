import type { EIP1193Provider } from "@privy-io/react-auth";

import type { PublicCourseSummary } from "../api/types.ts";
import { contractAddresses, courseCertificateAbi, hasSepoliaContractConfig } from "./contracts.ts";
import { assertSepolia, clients, getConnectedAccount, requireAddress } from "./purchase.ts";

export interface OwnedCertificate {
  tokenId: string;
  courseId: string;
  courseSlug: string;
  courseTitle: string;
}

export async function readOwnedCertificates(
  provider: EIP1193Provider,
  courses: readonly PublicCourseSummary[],
): Promise<OwnedCertificate[]> {
  if (!hasSepoliaContractConfig) throw new Error("Sepolia 合约地址尚未配置");
  await assertSepolia(provider);
  const account = await getConnectedAccount(provider);
  const { publicClient } = clients(provider, account);
  const certificate = requireAddress(contractAddresses.courseCertificate, "VITE_COURSE_CERTIFICATE_ADDRESS");
  const results = await Promise.all(courses.flatMap((course) => course.chainCourseId ? [readOne(course)] : []));
  return results.filter((item): item is OwnedCertificate => item !== null);

  async function readOne(course: PublicCourseSummary): Promise<OwnedCertificate | null> {
    if (!course.chainCourseId) return null;
    const tokenId = await publicClient.readContract({
      address: certificate,
      abi: courseCertificateAbi,
      functionName: "certificateOf",
      args: [BigInt(course.chainCourseId), account],
    });
    return tokenId === 0n ? null : {
      tokenId: tokenId.toString(),
      courseId: course.chainCourseId,
      courseSlug: course.slug,
      courseTitle: course.title,
    };
  }
}
