import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildApp } from "../src/app.js";
import type { CourseDetail } from "../src/domain/course.js";
import { createMockRepositories } from "../src/repositories/create-repositories.js";
import { demoCourses } from "../src/repositories/mock-data.js";
import { MockDataStore } from "../src/repositories/mock-store.js";

const STUDENT = "Bearer demo:demo-student";

const [demoCourse] = demoCourses;
assert.ok(demoCourse);

const SECTION_ONE = "55555555-5555-4555-8555-555500000001";
const SECTION_TWO = "55555555-5555-4555-8555-555500000002";
const SECTION_THREE = "55555555-5555-4555-8555-555500000003";
const SECTION_IDS = [SECTION_ONE, SECTION_TWO, SECTION_THREE];
const FOREIGN_SECTION_ID = "99999999-9999-4999-8999-999999999999";

const publishedCourse: CourseDetail = {
  ...demoCourse,
  id: "55555555-5555-4555-8555-555555555555",
  slug: "learning-demo",
  lessonCount: SECTION_IDS.length,
  sections: SECTION_IDS.map((id, index) => ({
    id,
    position: index + 1,
    title: `第 ${index + 1} 节`,
    originalTitle: null,
    durationSeconds: 300,
  })),
};

const draftCourse: CourseDetail = {
  ...publishedCourse,
  id: "66666666-6666-4666-8666-666666666666",
  slug: "learning-draft",
  status: "draft",
};

const emptyCourse: CourseDetail = {
  ...publishedCourse,
  id: "77777777-7777-4777-8777-777777777777",
  slug: "learning-empty",
  lessonCount: 0,
  sections: [],
};

function buildLearningApp() {
  return buildApp({
    repositories: createMockRepositories(
      new MockDataStore({ courses: [publishedCourse, draftCourse, emptyCourse] }),
    ),
  });
}

function progressUrl(slug = publishedCourse.slug) {
  return `/api/learning/courses/${slug}/progress`;
}

function completeUrl(sectionId: string, slug = publishedCourse.slug) {
  return `/api/learning/courses/${slug}/sections/${sectionId}/complete`;
}

describe("学习进度", () => {
  it("未登录访问一律返回 401", async () => {
    const app = await buildLearningApp();
    const sectionId = SECTION_ONE;
    const read = await app.inject({ method: "GET", url: progressUrl() });
    const completed = await app.inject({ method: "POST", url: completeUrl(sectionId) });
    const canceled = await app.inject({ method: "DELETE", url: completeUrl(sectionId) });

    assert.equal(read.statusCode, 401);
    assert.equal(read.json().error, "UNAUTHENTICATED");
    assert.equal(completed.statusCode, 401);
    assert.equal(canceled.statusCode, 401);
    await app.close();
  });

  it("未上架课程返回 404", async () => {
    const app = await buildLearningApp();
    const headers = { authorization: STUDENT };
    const read = await app.inject({ method: "GET", url: progressUrl("learning-draft"), headers });
    const missing = await app.inject({ method: "GET", url: progressUrl("no-such-course"), headers });
    const completed = await app.inject({
      method: "POST",
      url: completeUrl(SECTION_ONE, "learning-draft"),
      headers,
    });

    assert.equal(read.statusCode, 404);
    assert.equal(read.json().error, "NOT_FOUND");
    assert.equal(missing.statusCode, 404);
    assert.equal(completed.statusCode, 404);
    await app.close();
  });

  it("小节不属于该课程返回 404，非 uuid 返回 400", async () => {
    const app = await buildLearningApp();
    const headers = { authorization: STUDENT };
    const foreign = await app.inject({
      method: "POST",
      url: completeUrl(FOREIGN_SECTION_ID),
      headers,
    });
    const canceled = await app.inject({
      method: "DELETE",
      url: completeUrl(FOREIGN_SECTION_ID),
      headers,
    });
    const badId = await app.inject({ method: "POST", url: completeUrl("not-a-uuid"), headers });

    assert.equal(foreign.statusCode, 404);
    assert.equal(foreign.json().error, "NOT_FOUND");
    assert.equal(canceled.statusCode, 404);
    assert.equal(badId.statusCode, 400);
    assert.equal(badId.json().error, "INVALID_REQUEST");
    await app.close();
  });

  it("逐节完成后 percent 递增，全部完成后 completed 为 true", async () => {
    const app = await buildLearningApp();
    const headers = { authorization: STUDENT };
    const initial = await app.inject({ method: "GET", url: progressUrl(), headers });

    assert.equal(initial.statusCode, 200);
    assert.deepEqual(initial.json().data, {
      courseId: publishedCourse.id,
      slug: publishedCourse.slug,
      totalSections: 3,
      completedSectionIds: [],
      completedCount: 0,
      percent: 0,
      completed: false,
      completedAt: null,
    });

    const percents: number[] = [];
    for (const sectionId of SECTION_IDS) {
      const response = await app.inject({ method: "POST", url: completeUrl(sectionId), headers });
      assert.equal(response.statusCode, 200);
      percents.push(response.json().data.percent);
    }
    assert.deepEqual(percents, [33, 66, 100]);

    const finished = await app.inject({ method: "GET", url: progressUrl(), headers });
    assert.deepEqual(finished.json().data.completedSectionIds, SECTION_IDS);
    assert.equal(finished.json().data.completedCount, 3);
    assert.equal(finished.json().data.completed, true);
    assert.ok(finished.json().data.completedAt);
    await app.close();
  });

  it("重复标记完成幂等，进度不重复累加", async () => {
    const app = await buildLearningApp();
    const headers = { authorization: STUDENT };
    const sectionId = SECTION_ONE;
    const first = await app.inject({ method: "POST", url: completeUrl(sectionId), headers });
    const again = await app.inject({ method: "POST", url: completeUrl(sectionId), headers });

    assert.equal(again.statusCode, 200);
    assert.deepEqual(again.json().data, first.json().data);
    assert.equal(again.json().data.completedCount, 1);
    assert.equal(again.json().data.percent, 33);
    await app.close();
  });

  it("取消完成后 percent 回落，但首次学完的时间保留", async () => {
    const app = await buildLearningApp();
    const headers = { authorization: STUDENT };
    for (const sectionId of SECTION_IDS) {
      await app.inject({ method: "POST", url: completeUrl(sectionId), headers });
    }
    const finished = await app.inject({ method: "GET", url: progressUrl(), headers });
    const completedAt = finished.json().data.completedAt;
    assert.ok(completedAt);

    const canceled = await app.inject({
      method: "DELETE",
      url: completeUrl(SECTION_THREE),
      headers,
    });
    assert.equal(canceled.statusCode, 200);
    assert.equal(canceled.json().data.percent, 66);
    assert.equal(canceled.json().data.completed, false);
    assert.deepEqual(canceled.json().data.completedSectionIds, SECTION_IDS.slice(0, 2));
    assert.equal(canceled.json().data.completedAt, completedAt);

    // 取消完成同样幂等
    const again = await app.inject({
      method: "DELETE",
      url: completeUrl(SECTION_THREE),
      headers,
    });
    assert.deepEqual(again.json().data, canceled.json().data);
    await app.close();
  });

  it("没有小节的课程 percent 记 0 且不算学完", async () => {
    const app = await buildLearningApp();
    const response = await app.inject({
      method: "GET",
      url: progressUrl("learning-empty"),
      headers: { authorization: STUDENT },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.totalSections, 0);
    assert.equal(response.json().data.percent, 0);
    assert.equal(response.json().data.completed, false);
    assert.equal(response.json().data.completedAt, null);
    await app.close();
  });
});
