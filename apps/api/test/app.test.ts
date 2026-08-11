import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildApp } from "../src/app.js";

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
    assert.equal(detailResponse.statusCode, 200);
    assert.equal(detailResponse.json().data.priceYD, "4");
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
