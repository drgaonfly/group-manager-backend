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
const TARGET_ADDRESS = 'TT7uDJS5gtDya3hfSHPcSEUFHaPLhsxVtf';

// 查询四天内的所有USDT交易历史
// 弃用, 重复的
async function fetchTransfersLast4Days(): Promise<Trc20Transfer[]> {
  const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const startTimestamp = now - FOUR_DAYS_MS;
  const limit = 100; // 每页最大100
  let offset = 0;
  let allTransfers: Trc20Transfer[] = [];
  let hasMore = true;

  while (hasMore) {
    const url = new URL(
      'https://apilist.tronscan.org/api/token_trc20/transfers',
    );
    url.searchParams.set('contract_address', USDT_CONTRACT);
    url.searchParams.set('relatedAddress', TARGET_ADDRESS);
    url.searchParams.set('limit', limit.toString());
    url.searchParams.set('start', offset.toString());
    url.searchParams.set('order_by', 'block_timestamp');
    url.searchParams.set('sort', 'desc');

    try {
      const response = await axios.get<Trc20TransfersResponse>(url.toString());
      const transfers =
        response.data && Array.isArray(response.data.data)
          ? response.data.data
          : [];
      // 只保留四天内的USDT交易
      const filtered = transfers.filter(
        (t) =>
          t.block_timestamp >= startTimestamp && t.token_info.symbol === 'USDT',
      );
      allTransfers.push(...filtered);

      // 如果本页返回数量小于limit，说明已无更多数据
      if (transfers.length < limit) {
        hasMore = false;
      } else {
        // 检查最后一条是否已经早于四天前
        const minTs = Math.min(...transfers.map((t) => t.block_timestamp));
        if (minTs < startTimestamp) {
          hasMore = false;
        } else {
          offset += limit;
        }
      }
    } catch (error) {
      console.error(
        'API请求失败:',
        error instanceof Error ? error.message : error,
      );
      break;
    }
  }

  // 按时间升序返回
  allTransfers.sort((a, b) => a.block_timestamp - b.block_timestamp);
  return allTransfers;
}

function printTransfer(transfer: Trc20Transfer): void {
  const amount = (parseInt(transfer.value) / 1e6).toFixed(2);
  const direction =
    transfer.to_address.toLowerCase() === TARGET_ADDRESS.toLowerCase()
      ? '接收'
      : '发送';

  console.log(`📤 USDT交易（${direction}）：
  交易ID: ${transfer.transaction_id}
  时间: ${new Date(transfer.block_timestamp).toLocaleString()}
  金额: ${amount} USDT
  对方地址: ${
    direction === '接收' ? transfer.from_address : transfer.to_address
  }
  ------------------------`);
}

async function showLast4DaysTransfers() {
  try {
    const transfers = await fetchTransfersLast4Days();
    if (transfers.length === 0) {
      console.log('四天内无USDT交易记录');
      return;
    }
    console.log(`四天内共${transfers.length}条USDT交易记录：`);
    transfers.forEach(printTransfer);
  } catch (error) {
    console.error(
      '查询四天内交易时发生错误:',
      error instanceof Error ? error.message : error,
    );
  }
}

showLast4DaysTransfers();

console.log(`🚀 查询地址 ${TARGET_ADDRESS} 近四天的USDT交易历史...`);
