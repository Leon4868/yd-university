import type { Address } from "viem";

import type { PendingCompletion } from "../domain/progress.js";
import type { ProgressRepository } from "../repositories/progress-repository.js";
import type { CertificateChain } from "./certificate-chain.js";

export interface SweepResult {
  minted: number;
  /** 链上已有证书，跳过 */
  skipped: number;
  /** 本轮失败，留待下次扫描重试 */
  failed: number;
}

export interface CertificateIssuer {
  /** 触发一次发证扫描，立即返回，不阻塞调用方 */
  kick(): void;
  /** 直接跑一轮扫描，供启动补发与测试使用 */
  sweep(): Promise<SweepResult>;
  stop(): void;
}

export interface IssuerLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface ChainCertificateIssuerOptions {
  progress: ProgressRepository;
  chain: CertificateChain;
  logger: IssuerLogger;
  /** 定时兜底扫描间隔，用于重试上一轮失败的发证 */
  sweepIntervalMs?: number;
}

/** 证书元数据 URI 由链上课程 id 与钱包推导，同一条完成记录每次算出来都一样 */
export function certificateMetadataURI(chainCourseId: string, studentWallet: string) {
  return `ipfs://yd-university/certificates/${chainCourseId}/${studentWallet.toLowerCase()}`;
}

/**
 * 后端代发证书。
 *
 * 学员完成最后一节时由学习接口 kick 一次，扫描并铸造；同时定时兜底扫描，
 * 让上一轮失败的发证（RPC 抖动、gas 不足）在下一轮自动重试，不需要人工介入。
 *
 * 幂等由两层保证：扫描时先读链上 certificateOf 跳过已发的；真发出去时合约还会用
 * CertificateAlreadyMinted 挡一次。所以重复 kick、并发 kick、进程重启重放都不会重复铸造。
 */
export class ChainCertificateIssuer implements CertificateIssuer {
  private readonly progress: ProgressRepository;
  private readonly chain: CertificateChain;
  private readonly logger: IssuerLogger;
  private readonly timer: NodeJS.Timeout | null;
  private running = false;
  /** 扫描期间又被 kick，说明期间可能有新完成记录，跑完再补一轮 */
  private queued = false;

  constructor(options: ChainCertificateIssuerOptions) {
    this.progress = options.progress;
    this.chain = options.chain;
    this.logger = options.logger;
    const intervalMs = options.sweepIntervalMs ?? 0;
    this.timer = intervalMs > 0 ? setInterval(() => this.kick(), intervalMs) : null;
    // 兜底定时器不应该拖住进程退出
    this.timer?.unref();
  }

  kick(): void {
    if (this.running) {
      this.queued = true;
      return;
    }
    void this.runUntilQuiet();
  }

  async sweep(): Promise<SweepResult> {
    const pending = await this.progress.listPendingCompletions();
    const result: SweepResult = { minted: 0, skipped: 0, failed: 0 };

    for (const completion of pending) {
      try {
        if (await this.issue(completion)) {
          result.minted += 1;
        } else {
          result.skipped += 1;
        }
      } catch (error: unknown) {
        // 单条失败不能中断整轮，其余学员照发；这条留给下一轮重试
        result.failed += 1;
        this.logger.error(
          `发证失败 ${completion.courseSlug} → ${completion.studentWallet}：${describe(error)}`,
        );
      }
    }
    return result;
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** 返回 true 表示本次真的铸造了 */
  private async issue(completion: PendingCompletion): Promise<boolean> {
    const courseId = BigInt(completion.chainCourseId);
    const student = completion.studentWallet as Address;
    if ((await this.chain.certificateOf(courseId, student)) !== 0n) {
      return false;
    }
    const hash = await this.chain.mintCertificate(
      student,
      courseId,
      certificateMetadataURI(completion.chainCourseId, completion.studentWallet),
    );
    this.logger.info(`已发证 ${completion.courseSlug} → ${completion.studentWallet}，tx ${hash}`);
    return true;
  }

  private async runUntilQuiet(): Promise<void> {
    this.running = true;
    try {
      do {
        this.queued = false;
        const result = await this.sweep();
        if (result.minted > 0 || result.failed > 0) {
          this.logger.info(
            `发证扫描完成：铸造 ${result.minted}，跳过 ${result.skipped}，失败 ${result.failed}`,
          );
        }
      } while (this.queued);
    } catch (error: unknown) {
      this.logger.error(`发证扫描异常：${describe(error)}`);
    } finally {
      this.running = false;
    }
  }
}

/** 未配置发证钱包时使用，学习流程照常，只是不发证 */
export class DisabledCertificateIssuer implements CertificateIssuer {
  kick(): void {}
  async sweep(): Promise<SweepResult> {
    return { minted: 0, skipped: 0, failed: 0 };
  }
  stop(): void {}
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
