import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildApp } from "../src/app.js";
import { createMockRepositories } from "../src/repositories/create-repositories.js";
import { MockDataStore } from "../src/repositories/mock-store.js";

const STUDENT = "Bearer demo:demo-student";
const TEACHER = "Bearer demo:demo-teacher";
const ADMIN = "Bearer demo:demo-admin";

const teacherApplication = {
  role: "teacher",
  displayName: "新教师",
  walletAddress: "0x1111111111111111111111111111111111111111",
};

function buildTestApp() {
  return buildApp({ repositories: createMockRepositories(new MockDataStore()) });
}

function draft(slug: string) {
  return {
    slug,
    title: "全栈 Web3 实战",
    summary: "从合约到前端跑通一条完整链路。",
    category: "全栈",
    level: "进阶",
    priceYD: "6",
    coverTone: "blue",
    sections: [{ title: "环境准备", durationSeconds: 300 }],
  };
}

describe("认证与角色", () => {
  it("未带 token 访问 /api/me 返回 401", async () => {
    const app = await buildTestApp();
    const response = await app.inject({ method: "GET", url: "/api/me" });

    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error, "UNAUTHENTICATED");
    await app.close();
  });

  it("token 无效或用户不存在返回 401", async () => {
    const app = await buildTestApp();
    const badScheme = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: { authorization: "Bearer not-a-demo-token" },
    });
    const unknownUser = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: { authorization: "Bearer demo:nobody" },
    });

    assert.equal(badScheme.statusCode, 401);
    assert.equal(unknownUser.statusCode, 401);
    await app.close();
  });

  it("学生访问管理端返回 403", async () => {
    const app = await buildTestApp();
    const creators = await app.inject({
      method: "GET",
      url: "/api/admin/creators",
      headers: { authorization: STUDENT },
    });
    const courses = await app.inject({
      method: "GET",
      url: "/api/admin/courses",
      headers: { authorization: STUDENT },
    });

    assert.equal(creators.statusCode, 403);
    assert.equal(creators.json().error, "FORBIDDEN");
    assert.equal(courses.statusCode, 403);
    await app.close();
  });

  it("/api/me 返回数据库里的角色与创作者申请", async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: { authorization: TEACHER },
    });
    const me = response.json().data;

    assert.equal(response.statusCode, 200);
    assert.equal(me.role, "teacher");
    assert.equal(me.creator.reviewStatus, "approved");
    assert.equal(me.creator.role, "teacher");
    await app.close();
  });
});

describe("创作者申请与审核", () => {
  it("学生申请教师并通过审核后角色升为 teacher", async () => {
    const app = await buildTestApp();
    const applied = await app.inject({
      method: "POST",
      url: "/api/creators/applications",
      headers: { authorization: STUDENT },
      payload: teacherApplication,
    });
    assert.equal(applied.statusCode, 201);
    assert.equal(applied.json().data.reviewStatus, "pending");

    const mine = await app.inject({
      method: "GET",
      url: "/api/creators/applications/mine",
      headers: { authorization: STUDENT },
    });
    assert.equal(mine.json().data.id, applied.json().data.id);

    const pending = await app.inject({
      method: "GET",
      url: "/api/admin/creators?status=pending",
      headers: { authorization: ADMIN },
    });
    assert.equal(pending.statusCode, 200);
    assert.equal(pending.json().data.length, 1);
    assert.equal(pending.json().data[0].applicant.username, "演示学生");

    const approved = await app.inject({
      method: "POST",
      url: `/api/admin/creators/${applied.json().data.id}/approve`,
      headers: { authorization: ADMIN },
    });
    assert.equal(approved.statusCode, 200);
    assert.equal(approved.json().data.reviewStatus, "approved");

    const me = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: { authorization: STUDENT },
    });
    assert.equal(me.json().data.role, "teacher");
    await app.close();
  });

  it("驳回缺 reason 返回 400，重复审核返回 409", async () => {
    const app = await buildTestApp();
    const applied = await app.inject({
      method: "POST",
      url: "/api/creators/applications",
      headers: { authorization: STUDENT },
      payload: teacherApplication,
    });
    const id = applied.json().data.id;

    const missingReason = await app.inject({
      method: "POST",
      url: `/api/admin/creators/${id}/reject`,
      headers: { authorization: ADMIN },
      payload: {},
    });
    assert.equal(missingReason.statusCode, 400);
    assert.equal(missingReason.json().error, "INVALID_REQUEST");

    const rejected = await app.inject({
      method: "POST",
      url: `/api/admin/creators/${id}/reject`,
      headers: { authorization: ADMIN },
      payload: { reason: "资料不完整" },
    });
    assert.equal(rejected.statusCode, 200);
    assert.equal(rejected.json().data.rejectionReason, "资料不完整");

    const again = await app.inject({
      method: "POST",
      url: `/api/admin/creators/${id}/approve`,
      headers: { authorization: ADMIN },
    });
    assert.equal(again.statusCode, 409);
    assert.equal(again.json().error, "INVALID_STATE_TRANSITION");

    // 驳回后角色不变，且允许重新提交复用同一行
    const me = await app.inject({ method: "GET", url: "/api/me", headers: { authorization: STUDENT } });
    assert.equal(me.json().data.role, "student");

    const resubmitted = await app.inject({
      method: "POST",
      url: "/api/creators/applications",
      headers: { authorization: STUDENT },
      payload: teacherApplication,
    });
    assert.equal(resubmitted.statusCode, 201);
    assert.equal(resubmitted.json().data.id, id);
    assert.equal(resubmitted.json().data.reviewStatus, "pending");
    assert.equal(resubmitted.json().data.rejectionReason, null);
    await app.close();
  });

  it("同一用户同一角色重复申请返回 409", async () => {
    const app = await buildTestApp();
    await app.inject({
      method: "POST",
      url: "/api/creators/applications",
      headers: { authorization: STUDENT },
      payload: teacherApplication,
    });
    const duplicated = await app.inject({
      method: "POST",
      url: "/api/creators/applications",
      headers: { authorization: STUDENT },
      payload: teacherApplication,
    });

    assert.equal(duplicated.statusCode, 409);
    assert.equal(duplicated.json().error, "INVALID_STATE_TRANSITION");
    assert.equal(duplicated.json().message, "你已提交过该角色的申请");
    await app.close();
  });

  it("钱包已被其他申请占用返回 409", async () => {
    const app = await buildTestApp();
    const occupied = await app.inject({
      method: "POST",
      url: "/api/creators/applications",
      headers: { authorization: STUDENT },
      payload: {
        role: "teacher",
        displayName: "冒名申请",
        walletAddress: "0xe1E5016aF35DfD90ccb6Bc03654D156b3f29764D",
      },
    });

    assert.equal(occupied.statusCode, 409);
    assert.equal(occupied.json().message, "该钱包已被其他申请占用");
    await app.close();
  });

  it("申请参数不合法返回 400", async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/creators/applications",
      headers: { authorization: STUDENT },
      payload: { role: "teacher", displayName: "新教师", walletAddress: "0x123" },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error, "INVALID_REQUEST");
    await app.close();
  });
});

describe("课程上架流转", () => {
  it("未通过审核的教师建课返回 403", async () => {
    const app = await buildTestApp();
    await app.inject({
      method: "POST",
      url: "/api/creators/applications",
      headers: { authorization: STUDENT },
      payload: teacherApplication,
    });

    const created = await app.inject({
      method: "POST",
      url: "/api/teacher/courses",
      headers: { authorization: STUDENT },
      payload: draft("pending-teacher-course"),
    });
    const listed = await app.inject({
      method: "GET",
      url: "/api/teacher/courses",
      headers: { authorization: STUDENT },
    });

    assert.equal(created.statusCode, 403);
    assert.equal(created.json().error, "FORBIDDEN");
    assert.equal(listed.statusCode, 403);
    await app.close();
  });

  it("建草稿 → 提交审核 → 上架后出现在公开课程列表", async () => {
    const app = await buildTestApp();
    const created = await app.inject({
      method: "POST",
      url: "/api/teacher/courses",
      headers: { authorization: TEACHER },
      payload: draft("fullstack-web3"),
    });
    assert.equal(created.statusCode, 201);
    assert.equal(created.json().data.status, "draft");
    const courseId = created.json().data.id;

    const submitted = await app.inject({
      method: "POST",
      url: `/api/teacher/courses/${courseId}/submit`,
      headers: { authorization: TEACHER },
    });
    assert.equal(submitted.statusCode, 200);
    assert.equal(submitted.json().data.status, "review");
    assert.ok(submitted.json().data.submittedAt);

    const reviewQueue = await app.inject({
      method: "GET",
      url: "/api/admin/courses",
      headers: { authorization: ADMIN },
    });
    assert.deepEqual(
      reviewQueue.json().data.map((course: { slug: string }) => course.slug),
      ["fullstack-web3"],
    );

    const published = await app.inject({
      method: "POST",
      url: `/api/admin/courses/${courseId}/publish`,
      headers: { authorization: ADMIN },
    });
    assert.equal(published.statusCode, 200);
    assert.equal(published.json().data.status, "published");
    assert.ok(published.json().data.publishedAt);
    assert.ok(published.json().data.reviewedAt);

    const publicList = await app.inject({ method: "GET", url: "/api/courses" });
    const slugs = publicList.json().data.map((course: { slug: string }) => course.slug);
    assert.ok(slugs.includes("fullstack-web3"));

    const detail = await app.inject({ method: "GET", url: "/api/courses/fullstack-web3" });
    assert.equal(detail.statusCode, 200);
    assert.equal(detail.json().data.sections.length, 1);
    assert.equal(detail.json().data.lessonCount, 1);
    await app.close();
  });

  it("草稿直接上架返回 409，重复提交审核返回 409", async () => {
    const app = await buildTestApp();
    const created = await app.inject({
      method: "POST",
      url: "/api/teacher/courses",
      headers: { authorization: TEACHER },
      payload: draft("draft-only-course"),
    });
    const courseId = created.json().data.id;

    const published = await app.inject({
      method: "POST",
      url: `/api/admin/courses/${courseId}/publish`,
      headers: { authorization: ADMIN },
    });
    assert.equal(published.statusCode, 409);
    assert.equal(published.json().error, "INVALID_STATE_TRANSITION");

    await app.inject({
      method: "POST",
      url: `/api/teacher/courses/${courseId}/submit`,
      headers: { authorization: TEACHER },
    });
    const submittedAgain = await app.inject({
      method: "POST",
      url: `/api/teacher/courses/${courseId}/submit`,
      headers: { authorization: TEACHER },
    });
    assert.equal(submittedAgain.statusCode, 409);

    const publicList = await app.inject({ method: "GET", url: "/api/courses" });
    const slugs = publicList.json().data.map((course: { slug: string }) => course.slug);
    assert.equal(slugs.includes("draft-only-course"), false);
    await app.close();
  });

  it("课程 slug 重复返回 409，驳回退回草稿", async () => {
    const app = await buildTestApp();
    await app.inject({
      method: "POST",
      url: "/api/teacher/courses",
      headers: { authorization: TEACHER },
      payload: draft("solidity-from-zero"),
    });
    const duplicated = await app.inject({
      method: "POST",
      url: "/api/teacher/courses",
      headers: { authorization: TEACHER },
      payload: draft("solidity-from-zero"),
    });
    assert.equal(duplicated.statusCode, 409);

    const created = await app.inject({
      method: "POST",
      url: "/api/teacher/courses",
      headers: { authorization: TEACHER },
      payload: draft("needs-rework"),
    });
    const courseId = created.json().data.id;
    await app.inject({
      method: "POST",
      url: `/api/teacher/courses/${courseId}/submit`,
      headers: { authorization: TEACHER },
    });

    const missingReason = await app.inject({
      method: "POST",
      url: `/api/admin/courses/${courseId}/reject`,
      headers: { authorization: ADMIN },
      payload: {},
    });
    assert.equal(missingReason.statusCode, 400);

    const rejected = await app.inject({
      method: "POST",
      url: `/api/admin/courses/${courseId}/reject`,
      headers: { authorization: ADMIN },
      payload: { reason: "大纲太薄" },
    });
    assert.equal(rejected.statusCode, 200);
    assert.equal(rejected.json().data.status, "draft");
    assert.equal(rejected.json().data.rejectionReason, "大纲太薄");

    const resubmitted = await app.inject({
      method: "POST",
      url: `/api/teacher/courses/${courseId}/submit`,
      headers: { authorization: TEACHER },
    });
    assert.equal(resubmitted.statusCode, 200);
    assert.equal(resubmitted.json().data.rejectionReason, null);
    await app.close();
  });

  it("建课时传 sections[].url 会被拒绝", async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/teacher/courses",
      headers: { authorization: TEACHER },
      payload: {
        ...draft("legacy-url-course"),
        sections: [{ title: "环境准备", url: "https://example.com/lesson-1" }],
      },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error, "INVALID_REQUEST");
    await app.close();
  });

  it("教师只能看到并提交自己的课程", async () => {
    const app = await buildTestApp();
    const mine = await app.inject({
      method: "GET",
      url: "/api/teacher/courses",
      headers: { authorization: TEACHER },
    });
    assert.equal(mine.statusCode, 200);
    assert.equal(mine.json().data.length, 3);

    const missing = await app.inject({
      method: "POST",
      url: "/api/teacher/courses/99999999-9999-4999-8999-999999999999/submit",
      headers: { authorization: TEACHER },
    });
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.json().error, "NOT_FOUND");

    const badId = await app.inject({
      method: "POST",
      url: "/api/teacher/courses/not-a-uuid/submit",
      headers: { authorization: TEACHER },
    });
    assert.equal(badId.statusCode, 400);
    await app.close();
  });
});

describe("外部身份提供方接入", () => {
  it("Privy 模式下校验通过但库里没有账号时按学生自动建号", async () => {
    const store = new MockDataStore();
    const app = await buildApp({
      repositories: createMockRepositories(store),
      authVerifier: {
        autoProvision: true,
        async verify(token: string) {
          return token === "real-privy-jwt" ? { subject: "did:privy:abc123xyz" } : null;
        },
      },
    });

    const before = store.users.length;
    const created = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: { authorization: "Bearer real-privy-jwt" },
    });
    assert.equal(created.statusCode, 200);
    assert.equal(created.json().data.role, "student");
    assert.equal(store.users.length, before + 1);

    const again = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: { authorization: "Bearer real-privy-jwt" },
    });
    assert.equal(again.json().data.id, created.json().data.id);
    assert.equal(store.users.length, before + 1);

    const forged = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: { authorization: "Bearer forged" },
    });
    assert.equal(forged.statusCode, 401);
    assert.equal(store.users.length, before + 1);
    await app.close();
  });

  it("demo 模式不自动建号，未知 subject 一律 401", async () => {
    const store = new MockDataStore();
    const app = await buildApp({ repositories: createMockRepositories(store) });

    const before = store.users.length;
    const response = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: { authorization: "Bearer demo:whoever" },
    });

    assert.equal(response.statusCode, 401);
    assert.equal(store.users.length, before);
    await app.close();
  });

  it("BOOTSTRAP_ADMIN_SUBJECTS 白名单在登录时把管理员角色落库", async () => {
    const store = new MockDataStore();
    const app = await buildApp({
      repositories: createMockRepositories(store),
      bootstrapAdminSubjects: ["demo-student"],
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: { authorization: "Bearer demo:demo-student" },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.role, "admin");
    assert.equal(store.users.find((user) => user.privyUserId === "demo-student")?.role, "admin");
    await app.close();
  });
});
