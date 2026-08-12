import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildApp } from "../src/app.js";
import { createMockRepositories } from "../src/repositories/create-repositories.js";
import { demoCourses } from "../src/repositories/mock-data.js";
import { MockDataStore } from "../src/repositories/mock-store.js";

describe("YD University API", () => {
  it("reports health", async () => {
    const app = await buildApp();
    const response = await app.inject({ method: "GET", url: "/health" });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      status: "ok",
      service: "yd-university-api",
    });
    await app.close();
  });

  it("lists demo courses and resolves one slug", async () => {
    const app = await buildApp();
    const listResponse = await app.inject({ method: "GET", url: "/api/courses" });
    const detailResponse = await app.inject({
      method: "GET",
      url: "/api/courses/solidity-from-zero",
    });

    assert.equal(listResponse.statusCode, 200);
    assert.equal(listResponse.json().data.length, 3);
    assert.equal("sections" in listResponse.json().data[0], false);
    assert.equal(detailResponse.statusCode, 200);
    assert.equal(detailResponse.json().data.priceYD, "4");
    await app.close();
  });

  it("returns course detail with ordered sections and source info", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/courses/solidity-from-zero",
    });
    const course = response.json().data;

    assert.equal(response.statusCode, 200);
    assert.equal(course.providerName, "Cyfrin Updraft");
    assert.equal(course.courseUrl, "https://updraft.cyfrin.io/courses/solidity");
    assert.equal(course.teacherXUrl, "https://x.com/PatrickAlphaC");
    assert.ok(course.sections.length > 0);
    assert.equal(course.sections.length, course.lessonCount);
    assert.deepEqual(
      course.sections.map((section: { position: number }) => section.position),
      course.sections.map((_section: unknown, index: number) => index + 1),
    );
    assert.deepEqual(course.sections[0], {
      id: "11111111-1111-4111-8111-111100000001",
      position: 1,
      title: "课程导论",
      originalTitle: "Introduction",
      durationSeconds: 180,
    });
    await app.close();
  });

  it("hides courses that are not published yet", async () => {
    const [publishedCourse] = demoCourses;
    assert.ok(publishedCourse);
    const pendingCourse = {
      ...publishedCourse,
      id: "44444444-4444-4444-8444-444444444444",
      slug: "pending-review-course",
      status: "review" as const,
    };
    const app = await buildApp({
      repositories: createMockRepositories(
        new MockDataStore({ courses: [publishedCourse, pendingCourse] }),
      ),
    });

    const listResponse = await app.inject({ method: "GET", url: "/api/courses" });
    const detailResponse = await app.inject({
      method: "GET",
      url: "/api/courses/pending-review-course",
    });

    assert.equal(listResponse.statusCode, 200);
    assert.deepEqual(
      listResponse.json().data.map((course: { slug: string }) => course.slug),
      [publishedCourse.slug],
    );
    assert.equal(detailResponse.statusCode, 404);
    assert.deepEqual(detailResponse.json(), { error: "COURSE_NOT_FOUND" });
    await app.close();
  });

  it("returns semantic errors for invalid and missing slugs", async () => {
    const app = await buildApp();
    const invalidResponse = await app.inject({ method: "GET", url: "/api/courses/BAD!" });
    const missingResponse = await app.inject({ method: "GET", url: "/api/courses/not-found" });

    assert.equal(invalidResponse.statusCode, 400);
    assert.equal(missingResponse.statusCode, 404);
    await app.close();
  });
});
