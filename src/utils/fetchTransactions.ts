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

async function fetchTrc20Transactions(address: string) {
  const url = `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20`;

  const key = getNextApiKey();

  const response = await axios.get(url, {
    headers: {
      Accept: 'application/json',
      'TRON-PRO-API-KEY': key,
    },
  });

  return response.data.data;
}

const getAccountBalances = async (accountId: string) => {
  const url = `https://api.trongrid.io/v1/accounts/${accountId}`;

  const key = getNextApiKey();

  // console.log('key key', key)

  try {
    const response = await axios.get(url, {
      headers: { 'TRON-PRO-API-KEY': key },
    });

    const data = response.data.data[0];

    // 获取 TRX 余额
    const trxBalance = data.balance / 100_00_00;

    // 计算所有 TRC20 代币的总余额
    // const usdtBalance = data.trc20.reduce(
    //   (total: number, token: { [key: string]: string }) => {
    //     // 对每个 TRC20 代币余额进行累加
    //     const tokenBalance = Object.values(token).reduce((sum = 0, balance) => {
    //       const balanceInDecimals = parseInt(balance) / 100_00_00;
    //       return sum + balanceInDecimals;
    //     }, 0);
    //     return total + tokenBalance;
    //   },
    //   0,
    // );

    const usdtBalance =
      Number(data.trc20['TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t']) / 100_00_00;

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
