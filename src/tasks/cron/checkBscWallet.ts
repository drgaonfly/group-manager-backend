import axios from 'axios';

interface BscTokenTransfer {
  hash: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  tokenSymbol: string;
  contractAddress: string;
}

interface BscScanResponse {
  status: '0' | '1';
  message: string;
  result: BscTokenTransfer[];
}

const BSC_API_KEY = '7ND64XHWHK7NR5SHU8I4CEZPYID2BJPIM3';
const USDT_CONTRACT = '0x55d398326f99059fF775485246999027B3197955'; // BSC USDT合约
const TARGET_ADDRESS = '0x00000047bb99ea4d791bb749d970de71ee0b1a34';
const CHECK_INTERVAL = 30000; // 30秒检查一次

let lastCheckedTimestamp: number = Math.floor(Date.now() / 1000) - 60; // 初始化为1分钟前（秒级时间戳）

async function fetchNewTransfers(): Promise<BscTokenTransfer[]> {
  const url = new URL('https://api.bscscan.com/api');

  url.searchParams.set('module', 'account');
  url.searchParams.set('action', 'tokentx');
  url.searchParams.set('contractaddress', USDT_CONTRACT);
  url.searchParams.set('address', TARGET_ADDRESS);
  url.searchParams.set('startblock', '0');
  url.searchParams.set('endblock', '99999999');
  url.searchParams.set('sort', 'asc');
  url.searchParams.set('apikey', BSC_API_KEY);

  try {
    const response = await axios.get<BscScanResponse>(url.toString());

    if (response.data.status !== '1') {
      throw new Error(`BscScan API 错误: ${response.data.message}`);
    }

    return response.data.result.filter(
      (t) =>
        parseInt(t.timeStamp) > lastCheckedTimestamp &&
        t.tokenSymbol === 'USDT',
    );
  } catch (error) {
    console.error(
      'API请求失败:',
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

function processTransfer(transfer: BscTokenTransfer): void {
  const timestamp = parseInt(transfer.timeStamp) * 1000;
  const amount = (parseInt(transfer.value) / 1e18).toFixed(2); // BSC USDT使用18位小数
  const direction =
    transfer.to.toLowerCase() === TARGET_ADDRESS.toLowerCase()
      ? '接收'
      : '发送';

  console.log(`📤 新USDT交易（${direction}）：
  交易哈希: ${transfer.hash}
  时间: ${new Date(timestamp).toLocaleString()}
  金额: ${amount} USDT
  对方地址: ${direction === '接收' ? transfer.from : transfer.to}
  ------------------------`);
}

async function checkTransfers() {
  try {
    const transfers = await fetchNewTransfers();

    if (transfers.length > 0) {
      transfers.forEach((t) => {
        processTransfer(t);
        // 更新最后时间戳
        lastCheckedTimestamp = Math.max(
          lastCheckedTimestamp,
          parseInt(t.timeStamp),
        );
      });
    }
  } catch (error) {
    console.error(
      '检查交易时发生错误:',
      error instanceof Error ? error.message : error,
    );
  }
}

console.log(`🚀 开始监控地址 ${TARGET_ADDRESS} 的BSC USDT交易...`);
// 立即运行一次后按间隔执行
checkTransfers();
setInterval(checkTransfers, CHECK_INTERVAL);
