import axios from 'axios';

interface Trc20Transfer {
  transaction_id: string;
  block_timestamp: number;
  from_address: string;
  to_address: string;
  value: string;
  token_info: {
    symbol: string;
  };
}

interface Trc20TransfersResponse {
  data: Trc20Transfer[];
  total: number;
}

const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const TARGET_ADDRESS = '';
// const CHECK_INTERVAL = 30000; // 30秒检查一次

let lastCheckedTimestamp: number = Date.now() - 60000; // 初始化为1分钟前

async function fetchNewTransfers(): Promise<Trc20Transfer[]> {
  const url = new URL('https://apilist.tronscan.org/api/token_trc20/transfers');

  url.searchParams.set('contract_address', USDT_CONTRACT);
  url.searchParams.set('relatedAddress', TARGET_ADDRESS);
  url.searchParams.set('limit', '50');
  url.searchParams.set('order_by', 'block_timestamp');
  url.searchParams.set('sort', 'desc');

  try {
    const response = await axios.get<Trc20TransfersResponse>(url.toString());
    return response.data.data.filter(
      (t) =>
        t.block_timestamp > lastCheckedTimestamp &&
        t.token_info.symbol === 'USDT',
    );
  } catch (error) {
    console.error(
      'API请求失败:',
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

function processTransfer(transfer: Trc20Transfer): void {
  const amount = (parseInt(transfer.value) / 1e6).toFixed(2);
  const direction =
    transfer.to_address.toLowerCase() === TARGET_ADDRESS.toLowerCase()
      ? '接收'
      : '发送';

  console.log(`📤 新USDT交易（${direction}）：
  交易ID: ${transfer.transaction_id}
  时间: ${new Date(transfer.block_timestamp).toLocaleString()}
  金额: ${amount} USDT
  对方地址: ${
    direction === '接收' ? transfer.from_address : transfer.to_address
  }
  ------------------------`);
}

async function checkTransfers() {
  try {
    const transfers = await fetchNewTransfers();

    if (transfers.length > 0) {
      // 按时间戳升序处理
      transfers.sort((a, b) => a.block_timestamp - b.block_timestamp);

      transfers.forEach(processTransfer);

      // 更新最后时间戳（加1毫秒避免重复）
      lastCheckedTimestamp =
        Math.max(...transfers.map((t) => t.block_timestamp)) + 1;
    }
  } catch (error) {
    console.error(
      '检查交易时发生错误:',
      error instanceof Error ? error.message : error,
    );
  }
}

console.log(`🚀 开始监控地址 ${TARGET_ADDRESS} 的USDT交易...`);
// 立即运行一次后按间隔执行
// checkTransfers();
// setInterval(checkTransfers, CHECK_INTERVAL);
