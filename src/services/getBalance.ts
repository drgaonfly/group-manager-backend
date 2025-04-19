import { createPublicClient, http, formatUnits } from 'viem';
import { mainnet, bsc } from 'viem/chains';
import { TronWeb } from 'tronweb';

// USDT合约地址
export const USDT_CONTRACT_ADDRESSES = {
  ETH: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // 以太坊USDT合约地址
  BSC: '0x55d398326f99059fF775485246999027B3197955', // BSC USDT合约地址
  TRX: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', // TRX USDT合约地址
};

// USDT ABI (仅包含balanceOf方法)
const USDT_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
];

// 预加载客户端
export const ethClient = createPublicClient({
  chain: mainnet,
  transport: http('https://ethereum.publicnode.com'),
});

export const bscClient = createPublicClient({
  chain: bsc,
  transport: http('https://bsc-dataseed.binance.org'),
});

// 初始化TronWeb客户端
const tronWeb = new TronWeb({
  fullHost: 'https://api.trongrid.io',
  // headers: { 'TRON-PRO-API-KEY': process.env.TRON_API_KEY },
});

// 获取ETH网络USDT余额
export const fetchEthBalance = async (address: string): Promise<string> => {
  if (!address) {
    throw new Error('缺少钱包地址');
  }

  try {
    const data = await ethClient.readContract({
      address: USDT_CONTRACT_ADDRESSES.ETH as `0x${string}`,
      abi: USDT_ABI,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    });

    // USDT在以太坊上是6位小数
    let usdtBalance = formatUnits(data as bigint, 6);
    // 格式化为6位小数
    usdtBalance = parseFloat(usdtBalance).toFixed(6);

    console.log('ETH USDT余额:', usdtBalance);
    return usdtBalance;
  } catch (error) {
    console.error('以太坊USDT余额获取失败:', error);
    throw new Error('获取ETH USDT余额失败');
  }
};

// 获取BSC网络USDT余额
export const fetchBscBalance = async (address: string): Promise<string> => {
  if (!address) {
    throw new Error('缺少钱包地址');
  }

  try {
    const data = await bscClient.readContract({
      address: USDT_CONTRACT_ADDRESSES.BSC as `0x${string}`,
      abi: USDT_ABI,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    });

    // USDT在BSC上是18位小数
    let usdtBalance = formatUnits(data as bigint, 18);
    // 格式化为6位小数
    usdtBalance = parseFloat(usdtBalance).toFixed(6);

    console.log('BSC USDT余额:', usdtBalance);
    return usdtBalance;
  } catch (error) {
    console.error('BSC USDT余额获取失败:', error);
    throw new Error('获取BSC USDT余额失败');
  }
};

// 获取TRX网络USDT余额
// 这个需要有 key 暂时还有问题
export const fetchTrxBalance = async (address: string): Promise<string> => {
  if (!address) {
    throw new Error('缺少钱包地址');
  }

  try {
    // 获取USDT合约实例
    const contract = await tronWeb.contract().at(USDT_CONTRACT_ADDRESSES.TRX);

    // 调用balanceOf方法
    const balance = await contract.balanceOf(address).call();

    // USDT在TRX上是6位小数
    const usdtBalance = (parseFloat(balance.toString()) / 1e6).toFixed(6);

    console.log('TRX USDT余额:', usdtBalance);
    return usdtBalance;
  } catch (error) {
    console.error('TRX USDT余额获取失败:', error);
    throw new Error('获取TRX USDT余额失败');
  }
};

// 根据网络获取USDT余额
export const getUsdtBalance = async (
  address: string,
  network: 'ETH' | 'BSC' | 'TRX',
): Promise<string> => {
  if (!address) {
    throw new Error('缺少钱包地址');
  }

  if (!network) {
    throw new Error('缺少网络类型');
  }

  // 最大重试次数
  const maxRetries = 3;
  // 重试延迟时间（毫秒）
  const retryDelay = 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      let balance: string;

      switch (network) {
        case 'ETH':
          balance = await fetchEthBalance(address);
          break;
        case 'BSC':
          balance = await fetchBscBalance(address);
          break;
        case 'TRX':
          balance = await fetchTrxBalance(address);
          break;
        default:
          throw new Error('不支持的网络类型');
      }

      return balance;
    } catch (error) {
      console.error(
        `获取${network} USDT余额失败 (尝试 ${attempt}/${maxRetries}):`,
        error,
      );

      if (attempt === maxRetries) {
        throw new Error(`获取${network} USDT余额失败`);
      }

      // 等待一段时间后重试
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  // 这行代码实际上永远不会执行，但为了 TypeScript 类型检查需要返回值
  throw new Error(`获取${network} - ${address} USDT余额失败`);
};
