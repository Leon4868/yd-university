import type { CourseDetail } from "../domain/course.js";
import type { CreatorApplication, CreatorApplicationWithApplicant } from "../domain/creator.js";
import type { CourseProgress, SectionProgress } from "../domain/progress.js";
import type { User } from "../domain/user.js";

/** 契约里的创作者申请视图，审核人等内部字段不下发 */
export function toCreatorView(application: CreatorApplication) {
  return {
    id: application.id,
    role: application.role,
    displayName: application.displayName,
    walletAddress: application.walletAddress,
    reviewStatus: application.reviewStatus,
    rejectionReason: application.rejectionReason,
    reviewedAt: application.reviewedAt,
  };
}

export function toAdminCreatorView(application: CreatorApplicationWithApplicant) {
  return {
    ...toCreatorView(application),
    createdAt: application.createdAt,
    applicant: application.applicant,
  };
}

export function toCurrentUserView(user: User, creator: CreatorApplication | null) {
  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    primaryWallet: user.primaryWallet,
    role: user.role,
    creator: creator ? toCreatorView(creator) : null,
  };
}

/** 完成数换算成向下取整的百分比；空课程一律记 0 且不算学完 */
export function toCourseProgress(
  course: CourseDetail,
  sections: readonly SectionProgress[],
): CourseProgress {
  const bySection = new Map(sections.map((item) => [item.sectionId, item]));
  const completedSectionIds = course.sections
    .filter((section) => bySection.get(section.id)?.completed === true)
    .map((section) => section.id);
  const totalSections = course.sections.length;
  const percent =
    totalSections === 0 ? 0 : Math.floor((completedSectionIds.length * 100) / totalSections);
  return {
    courseId: course.id,
    slug: course.slug,
    totalSections,
    completedSectionIds,
    completedCount: completedSectionIds.length,
    percent,
    completed: totalSections > 0 && percent === 100,
    completedAt: firstCompletedAt(course, bySection),
  };
}

/** 每节都完成过才算学完，取其中最晚的首次完成时间；之后取消完成不清空 */
function firstCompletedAt(
  course: CourseDetail,
  bySection: Map<string, SectionProgress>,
): string | null {
  const stamps = course.sections
    .map((section) => bySection.get(section.id))
    .filter((entry): entry is SectionProgress => entry !== undefined)
    .map((entry) => entry.firstCompletedAt);
  if (course.sections.length === 0 || stamps.length < course.sections.length) {
    return null;
  }
  return stamps.reduce((latest, at) => (at > latest ? at : latest));
}
