import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { keccak256, parseEther, stringToHex } from "viem";

describe("YD University contracts", async function () {
  const { viem } = await network.create();
  const [admin, platform, teacher, merchant, student, forwarder, outsider] =
    await viem.getWalletClients();

  async function deployCore() {
    const token = await viem.deployContract("YDToken", [admin.account.address]);
    const registry = await viem.deployContract("CourseRegistry", [admin.account.address]);
    const market = await viem.deployContract("CourseMarket", [
      token.address,
      registry.address,
      platform.account.address,
      admin.account.address,
    ]);

    await registry.write.createCourse([
      teacher.account.address,
      merchant.account.address,
      parseEther("4"),
      7000,
      2000,
      1000,
      "ipfs://course-1",
    ]);

    return { token, registry, market };
  }

  async function buyFirstCourse() {
    const core = await deployCore();
    await core.token.write.transfer([student.account.address, parseEther("10")]);
    await student.writeContract({
      address: core.token.address,
      abi: core.token.abi,
      functionName: "approve",
      args: [core.market.address, parseEther("4")],
    });
    await student.writeContract({
      address: core.market.address,
      abi: core.market.abi,
      functionName: "buy",
      args: [1n, parseEther("4")],
    });
    return core;
  }

  it("mints the fixed 100,000 YD supply once", async function () {
    const token = await viem.deployContract("YDToken", [admin.account.address]);
    assert.equal(await token.read.totalSupply(), parseEther("100000"));
    assert.equal(await token.read.balanceOf([admin.account.address]), parseEther("100000"));
  });

  it("restricts course publishing and validates the 70/20/10 split", async function () {
    const registry = await viem.deployContract("CourseRegistry", [admin.account.address]);

    await assert.rejects(() =>
      outsider.writeContract({
        address: registry.address,
        abi: registry.abi,
        functionName: "createCourse",
        args: [
          teacher.account.address,
          merchant.account.address,
          parseEther("4"),
          7000,
          2000,
          1000,
          "ipfs://forbidden",
        ],
      }),
    );

    await assert.rejects(() =>
      registry.write.createCourse([
        teacher.account.address,
        merchant.account.address,
        parseEther("4"),
        7000,
        2000,
        999,
        "ipfs://bad-split",
      ]),
    );
  });

  it("buys with max-price protection and allocates pull-payment revenue", async function () {
    const { token, market } = await deployCore();
    await token.write.transfer([student.account.address, parseEther("10")]);
    await student.writeContract({
      address: token.address,
      abi: token.abi,
      functionName: "approve",
      args: [market.address, parseEther("10")],
    });

    await assert.rejects(() =>
      student.writeContract({
        address: market.address,
        abi: market.abi,
        functionName: "buy",
        args: [1n, parseEther("3.9")],
      }),
    );

    await student.writeContract({
      address: market.address,
      abi: market.abi,
      functionName: "buy",
      args: [1n, parseEther("4")],
    });

    assert.equal(await market.read.hasPurchased([1n, student.account.address]), true);
    assert.equal(await market.read.paidPrice([1n, student.account.address]), parseEther("4"));
    assert.equal(await market.read.pendingWithdrawals([teacher.account.address]), parseEther("2.8"));
    assert.equal(await market.read.pendingWithdrawals([merchant.account.address]), parseEther("0.8"));
    assert.equal(await market.read.pendingWithdrawals([platform.account.address]), parseEther("0.4"));

    await assert.rejects(() =>
      student.writeContract({
        address: market.address,
        abi: market.abi,
        functionName: "buy",
        args: [1n, parseEther("4")],
      }),
    );
  });

  it("lets recipients withdraw without blocking purchases", async function () {
    const { token, market } = await buyFirstCourse();
    const before = (await token.read.balanceOf([teacher.account.address])) as bigint;

    await teacher.writeContract({
      address: market.address,
      abi: market.abi,
      functionName: "withdraw",
    });

    assert.equal(await token.read.balanceOf([teacher.account.address]), before + parseEther("2.8"));
    assert.equal(await market.read.pendingWithdrawals([teacher.account.address]), 0n);
  });

  it("mints one certificate for a buyer and blocks transfers", async function () {
    const { market } = await buyFirstCourse();
    const certificate = await viem.deployContract("CourseCertificate", [
      market.address,
      admin.account.address,
    ]);

    await certificate.write.mintCertificate([student.account.address, 1n, "ipfs://certificate-1"]);
    assert.equal(
      ((await certificate.read.ownerOf([1n])) as string).toLowerCase(),
      student.account.address.toLowerCase(),
    );
    assert.equal(await certificate.read.certificateOf([1n, student.account.address]), 1n);

    await assert.rejects(() =>
      student.writeContract({
        address: certificate.address,
        abi: certificate.abi,
        functionName: "transferFrom",
        args: [student.account.address, outsider.account.address, 1n],
      }),
    );

    await assert.rejects(() =>
      certificate.write.mintCertificate([student.account.address, 1n, "ipfs://duplicate"]),
    );
  });

  it("accepts one authorized completion report and rejects replay", async function () {
    const { market } = await buyFirstCourse();
    const certificate = await viem.deployContract("CourseCertificate", [
      market.address,
      admin.account.address,
    ]);
    const receiver = await viem.deployContract("CompletionReceiver", [
      certificate.address,
      forwarder.account.address,
      admin.account.address,
    ]);
    const minterRole = await certificate.read.MINTER_ROLE();
    await certificate.write.grantRole([minterRole, receiver.address]);
    const completionId = keccak256(stringToHex("completion-1"));

    await assert.rejects(() =>
      outsider.writeContract({
        address: receiver.address,
        abi: receiver.abi,
        functionName: "onCompletionReport",
        args: [completionId, student.account.address, 1n, "ipfs://unauthorized"],
      }),
    );

    await forwarder.writeContract({
      address: receiver.address,
      abi: receiver.abi,
      functionName: "onCompletionReport",
      args: [completionId, student.account.address, 1n, "ipfs://certificate-cre"],
    });

    assert.equal(await receiver.read.consumedReports([completionId]), true);
    await assert.rejects(() =>
      forwarder.writeContract({
        address: receiver.address,
        abi: receiver.abi,
        functionName: "onCompletionReport",
        args: [completionId, student.account.address, 1n, "ipfs://certificate-cre"],
      }),
    );
  });
});
