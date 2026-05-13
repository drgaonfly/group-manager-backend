// import { TronWeb } from 'tronweb';
import axios from 'axios';

const API_KEYS = [
  '41720408-8a6a-4abc-b934-1c44e33719cc',
  '29475d12-d3ec-4b30-b457-529b85db312d',
  '6e526565-2246-4071-b302-6b18c3d73026',
  'f7177de2-a93b-4098-a252-9e92b4ac947b',
  '2c25b5d3-e66f-4e5a-98f6-07f17f26ed7f',
  '8f549a00-5f58-425d-95f8-6347a0e3eb36',
  'd4374957-910d-4509-b195-0be07c0dfa84',
  'bfd9db73-3447-443e-b47c-d6926d8b5579',
  'd4374957-910d-4509-b195-0be07c0dfa84',
];

// const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'; // 主网 USDT 合约

let lastUsedIndex = -1;

function getNextApiKey(): string {
  lastUsedIndex = (lastUsedIndex + 1) % API_KEYS.length;
  return API_KEYS[lastUsedIndex];
}

// // 初始化 TronWeb
// const tronWeb = new TronWeb({
//   fullHost: 'https://api.trongrid.io'
// });

async function fetchTrxTransactions(address: string) {
  const url = `https://api.trongrid.io/v1/accounts/${address}/transactions`;

  const key = getNextApiKey();

  const response = await axios.get(url, {
    headers: {
      Accept: 'application/json',
      'TRON-PRO-API-KEY': key,
    },
  });

  return response.data;
}

async function fetchTrc20Transactions(address: string, minutes = 1) {
  const start_time = Math.floor(
    (new Date().getTime() - minutes * 60 * 1000) / 1000,
  );

  const end_time = Math.floor(new Date().getTime() / 1000);

  // 官方 USDT TRC20 合约地址（主网固定）
  const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

  // 添加 contract_address 参数，只拉取 USDT 转账
  const url = `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20?start=${start_time}&end=${end_time}&contract_address=${USDT_CONTRACT}`;

  // 可选：添加 limit=200（默认20，最大200），避免数据过多
  // const url = `...&limit=200`;

  const key = getNextApiKey();

  try {
    const response = await axios.get(url, {
      headers: {
        Accept: 'application/json',
        'TRON-PRO-API-KEY': key,
      },
    });

    return response.data.data || [];
  } catch (error) {
    console.error('fetchTrc20Transactions error:', error);
    return [];
  }
}

const getAccountBalances = async (accountId: string) => {
  const url = `https://api.trongrid.io/v1/accounts/${accountId}`;
  const key = getNextApiKey();

  try {
    const response = await axios.get(url, {
      headers: { 'TRON-PRO-API-KEY': key },
    });

    const data = response.data.data?.[0];

    if (!data) throw new Error('No account data returned');

    const trxBalance = data.balance ? data.balance / 1e6 : 0;

    // 修复 USDT 余额获取
    let usdtBalance = 0;
    const usdtObj = data.trc20?.find(
      (item: Record<string, string>) =>
        'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' in item,
    );

    if (usdtObj) {
      const raw = usdtObj['TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'];
      if (!isNaN(Number(raw))) {
        usdtBalance = Number(raw) / 1e6;
      } else {
        console.warn('USDT value is not a valid number:', raw);
      }
    } else {
      console.warn('USDT contract not found in trc20 tokens');
    }

    return {
      trxBalance,
      usdtBalance,
    };
  } catch (error) {
    console.error('Error fetching account balances:', error);
    throw error;
  }
};

// async function getAccountResources(address: string) {
//   try {
//     // 1. 获取基础账户信息
//     const account = await tronWeb.trx.getAccount(address);

//     // 2. 获取 TRX 余额
//     const trxBalance = tronWeb.fromSun(account.balance);

//     // 3. 获取 USDT 余额
//     const usdtBalance = await getTRC20Balance(address, USDT_CONTRACT);

//     return {
//       trxBalance,
//       usdtBalance,

//       accountInfo: account,
//     };
//   } catch (error) {
//     console.error('获取账户资源失败:', error);
//     throw error;
//   }
// }

// async function getTRC20Balance(
//   address: string,
//   contractAddress: string,
// ): Promise<string> {
//   try {
//     tronWeb.setAddress(address); // 设置默认地址
//     const contract = await tronWeb.contract().at(contractAddress);
//     const balanceRaw = await contract.balanceOf(address).call(); // balanceRaw 是 BigInt

//     const balanceNum = Number(balanceRaw); // 显式转换
//     return (balanceNum / 1e6).toFixed(6); // USDT 是 6 位精度
//   } catch (error) {
//     console.error('获取TRC20余额失败:', error);
//     return '0';
//   }
// }

export { fetchTrxTransactions, fetchTrc20Transactions, getAccountBalances };
