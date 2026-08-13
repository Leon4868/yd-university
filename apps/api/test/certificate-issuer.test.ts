import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Address, Hash } from "viem";

import { buildApp } from "../src/app.js";
import type { CertificateChain } from "../src/chain/certificate-chain.js";
import {
  ChainCertificateIssuer,
  type CertificateIssuer,
  type SweepResult,
} from "../src/chain/certificate-issuer.js";
import type { CourseDetail } from "../src/domain/course.js";
import type { User } from "../src/domain/user.js";
import { createMockRepositories } from "../src/repositories/create-repositories.js";
import { demoCourses, demoUsers, DEMO_STUDENT_ID } from "../src/repositories/mock-data.js";
import { MockDataStore } from "../src/repositories/mock-store.js";

const STUDENT_WALLET = "0x934124d582dd6618309b0905b4DE2631A2892EEe";
const SECTION_ONE = "55555555-5555-4555-8555-555500000001";
const SECTION_TWO = "55555555-5555-4555-8555-555500000002";
const STUDENT_HEADERS = { authorization: "Bearer demo:demo-student" };

const [demoCourse] = demoCourses;
assert.ok(demoCourse);

const chainCourse: CourseDetail = {
  ...demoCourse,
  id: "55555555-5555-4555-8555-555555555555",
  slug: "cert-chain-course",
  chainCourseId: "7",
  lessonCount: 2,
  sections: [SECTION_ONE, SECTION_TWO].map((id, index) => ({
    id,
    position: index + 1,
    title: `第 ${index + 1} 节`,
    originalTitle: null,
    durationSeconds: 300,
  })),
};

function seededStore(wallet: string | null = STUDENT_WALLET) {
  const users: User[] = demoUsers.map((user) =>
    user.id === DEMO_STUDENT_ID ? { ...user, primaryWallet: wallet } : user,
  );
  return new MockDataStore({ users, courses: [chainCourse] });
}

function completeUrl(sectionId: string) {
  return `/api/learning/courses/${chainCourse.slug}/sections/${sectionId}/complete`;
}

const silentLogger = { info() {}, warn() {}, error() {} };

/** 记录调用而不连真链；mintCertificate 之前可以插一道闸门用来制造并发 */
class FakeChain implements CertificateChain {
  readonly mintCalls: Array<{ courseId: bigint; student: string; metadataURI: string }> = [];
  private readonly tokens = new Map<string, bigint>();
  private nextTokenId = 1n;
  /** key 命中时下一次铸造抛错，模拟 RPC 抖动 */
  readonly failOnce = new Set<string>();
  gate: Promise<void> | null = null;

  async certificateOf(courseId: bigint, student: Address): Promise<bigint> {
    return this.tokens.get(key(courseId, student)) ?? 0n;
  }

  async mintCertificate(student: Address, courseId: bigint, metadataURI: string): Promise<Hash> {
    if (this.gate) await this.gate;
    const id = key(courseId, student);
    this.mintCalls.push({ courseId, student, metadataURI });
    if (this.failOnce.delete(id)) {
      throw new Error("RPC timeout");
    }
    this.tokens.set(id, this.nextTokenId++);
    return `0x${"ab".repeat(32)}` as Hash;
  }
}

function key(courseId: bigint, student: string) {
  return `${courseId.toString()}:${student.toLowerCase()}`;
}

async function issuerWithCompletedCourse(wallet: string | null = STUDENT_WALLET) {
  const repositories = createMockRepositories(seededStore(wallet));
  for (const section of chainCourse.sections) {
    await repositories.progress.complete(DEMO_STUDENT_ID, section.id);
  }
  const chain = new FakeChain();
  const issuer = new ChainCertificateIssuer({
    progress: repositories.progress,
    chain,
    logger: silentLogger,
  });
  return { chain, issuer };
}

async function waitFor(predicate: () => boolean, label: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail(`等待超时：${label}`);
}

describe("后端代发证书", () => {
  it("学完最后一节才触发发证", async () => {
    let kicks = 0;
    const spy: CertificateIssuer = {
      kick: () => { kicks += 1; },
      sweep: async (): Promise<SweepResult> => ({ minted: 0, skipped: 0, failed: 0 }),
      stop: () => {},
    };
    const app = await buildApp({
      repositories: createMockRepositories(seededStore()),
      certificateIssuer: () => spy,
    });

    await app.inject({ method: "POST", url: completeUrl(SECTION_ONE), headers: STUDENT_HEADERS });
    assert.equal(kicks, 0, "只完成一半不该触发发证");

    await app.inject({ method: "POST", url: completeUrl(SECTION_TWO), headers: STUDENT_HEADERS });
    assert.equal(kicks, 1);

    // 取消完成会让进度掉回 50%，不该再触发
    await app.inject({ method: "DELETE", url: completeUrl(SECTION_TWO), headers: STUDENT_HEADERS });
    assert.equal(kicks, 1);
    await app.close();
  });

  it("扫描时按链上课程 id 与钱包铸造证书", async () => {
    const { chain, issuer } = await issuerWithCompletedCourse();

    assert.deepEqual(await issuer.sweep(), { minted: 1, skipped: 0, failed: 0 });
    assert.equal(chain.mintCalls.length, 1);
    assert.equal(chain.mintCalls[0]!.courseId, 7n);
    assert.equal(chain.mintCalls[0]!.student, STUDENT_WALLET);
    assert.equal(
      chain.mintCalls[0]!.metadataURI,
      `ipfs://yd-university/certificates/7/${STUDENT_WALLET.toLowerCase()}`,
    );
    issuer.stop();
  });

  it("链上已有证书就跳过，重复扫描不会重复铸造", async () => {
    const { chain, issuer } = await issuerWithCompletedCourse();

    await issuer.sweep();
    assert.deepEqual(await issuer.sweep(), { minted: 0, skipped: 1, failed: 0 });
    assert.equal(chain.mintCalls.length, 1, "第二轮不该再发交易");
    issuer.stop();
  });

  it("铸造失败留待下一轮重试", async () => {
    const { chain, issuer } = await issuerWithCompletedCourse();
    chain.failOnce.add(key(7n, STUDENT_WALLET));

    assert.deepEqual(await issuer.sweep(), { minted: 0, skipped: 0, failed: 1 });
    // 失败没有落链上状态，下一轮应当重新尝试并成功
    assert.deepEqual(await issuer.sweep(), { minted: 1, skipped: 0, failed: 0 });
    assert.equal(chain.mintCalls.length, 2);
    issuer.stop();
  });

  it("并发触发只铸造一次", async () => {
    const { chain, issuer } = await issuerWithCompletedCourse();
    let openGate = () => {};
    chain.gate = new Promise<void>((resolve) => { openGate = resolve; });

    issuer.kick();
    // 第一轮卡在闸门上，此时再 kick 只应排队，不应另起一轮扫描
    issuer.kick();
    openGate();

    await waitFor(() => chain.mintCalls.length > 0, "首次铸造");
    chain.gate = null;
    // 排队的那一轮扫描随后才跑，留出时间让它真正跑完再断言，否则等于没验到
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(chain.mintCalls.length, 1, "并发 kick 不应重复铸造");
    issuer.stop();
  });

  it("学员没绑定钱包就不发证", async () => {
    const { chain, issuer } = await issuerWithCompletedCourse(null);

    assert.deepEqual(await issuer.sweep(), { minted: 0, skipped: 0, failed: 0 });
    assert.equal(chain.mintCalls.length, 0);
    issuer.stop();
  });
});
