import { createPublicClient, createWalletClient, http, type Address, type Hash } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

/** 发证需要的链上能力，抽成接口是为了让测试用假实现替换，不必连真链 */
export interface CertificateChain {
  /** 0 表示尚未发证 */
  certificateOf(courseId: bigint, student: Address): Promise<bigint>;
  mintCertificate(student: Address, courseId: bigint, metadataURI: string): Promise<Hash>;
}

export const courseCertificateAbi = [
  {
    type: "function",
    name: "certificateOf",
    stateMutability: "view",
    inputs: [
      { name: "courseId", type: "uint256" },
      { name: "student", type: "address" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    name: "mintCertificate",
    stateMutability: "nonpayable",
    inputs: [
      { name: "student", type: "address" },
      { name: "courseId", type: "uint256" },
      { name: "metadataURI", type: "string" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
] as const;

export interface ViemCertificateChainOptions {
  rpcUrl: string;
  certificateAddress: Address;
  /** 独立发证钱包的私钥，只在这里读一次用于构造签名账户，不落日志、不外传 */
  issuerPrivateKey: string;
}

/**
 * 用独立发证钱包直接调用 CourseCertificate.mintCertificate。
 *
 * 该钱包只被授予 MINTER_ROLE，不持有 DEFAULT_ADMIN_ROLE，也不该放 YD 与多余 ETH：
 * 后端一旦被打穿，攻击者最多能给已购课的地址补发证书，动不了资金和权限。
 */
export class ViemCertificateChain implements CertificateChain {
  private readonly publicClient;
  private readonly walletClient;
  private readonly certificateAddress: Address;

  constructor(options: ViemCertificateChainOptions) {
    const transport = http(options.rpcUrl);
    this.certificateAddress = options.certificateAddress;
    this.publicClient = createPublicClient({ chain: sepolia, transport });
    this.walletClient = createWalletClient({
      account: privateKeyToAccount(options.issuerPrivateKey as `0x${string}`),
      chain: sepolia,
      transport,
    });
  }

  get issuerAddress(): Address {
    return this.walletClient.account.address;
  }

  async certificateOf(courseId: bigint, student: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.certificateAddress,
      abi: courseCertificateAbi,
      functionName: "certificateOf",
      args: [courseId, student],
    });
  }

  async mintCertificate(student: Address, courseId: bigint, metadataURI: string): Promise<Hash> {
    // 先模拟一次，把「未购买课程」「已发过证」这类必然 revert 的情况挡在发交易之前，不白烧 gas
    const { request } = await this.publicClient.simulateContract({
      account: this.walletClient.account,
      address: this.certificateAddress,
      abi: courseCertificateAbi,
      functionName: "mintCertificate",
      args: [student, courseId, metadataURI],
    });
    const hash = await this.walletClient.writeContract(request);
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw new Error(`铸造证书交易失败：${hash}`);
    }
    return hash;
  }
}
