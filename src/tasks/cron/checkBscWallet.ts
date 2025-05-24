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
const TARGET_ADDRESS = '0xbc1052230C4Ca96E052b98B8411f83114905d82d';
const CHECK_INTERVAL = 30000; // 30秒检查一次

/**
 * 获取最近15分钟的BSC USDT转账
 */
async function fetchRecent15MinTransfers(): Promise<BscTokenTransfer[]> {
  const url = new URL('https://api.bscscan.com/api');

  url.searchParams.set('module', 'account');
  url.searchParams.set('action', 'tokentx');
  url.searchParams.set('contractaddress', USDT_CONTRACT);
  url.searchParams.set('address', TARGET_ADDRESS);
  url.searchParams.set('startblock', '0');
  url.searchParams.set('endblock', '99999999');
  url.searchParams.set('sort', 'desc'); // 先返回最新的
  url.searchParams.set('apikey', BSC_API_KEY);

  const now = Math.floor(Date.now() / 1000);
  const fifteenMinAgo = now - 15 * 60;

  try {
    const response = await axios.get<BscScanResponse>(url.toString());

    if (response.data.status !== '1') {
      throw new Error(`BscScan API 错误: ${response.data.message}`);
    }

    // 只保留15分钟内的USDT转账
    return response.data.result.filter(
      (t) => parseInt(t.timeStamp) >= fifteenMinAgo && t.tokenSymbol === 'USDT',
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
    const transfers = await fetchRecent15MinTransfers();

    if (transfers.length > 0) {
      // 按时间升序输出
      transfers
        .sort((a, b) => parseInt(a.timeStamp) - parseInt(b.timeStamp))
        .forEach((t) => {
          processTransfer(t);
        });
    } else {
      console.log('最近15分钟无USDT交易');
    }
  } catch (error) {
    console.error(
      '检查交易时发生错误:',
      error instanceof Error ? error.message : error,
    );
  }
}

console.log(`🚀 查询地址 ${TARGET_ADDRESS} 近15分钟的BSC USDT交易...`);
// 立即运行一次后按间隔执行
checkTransfers();
setInterval(checkTransfers, CHECK_INTERVAL);
