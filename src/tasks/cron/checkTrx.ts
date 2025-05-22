interface Transfer {
  time: number;
  money: number;
  trade_id: string;
  buyer: string;
}

interface TransferResponse {
  token_transfers: Array<{
    to_address: string;
    finalResult: string;
    block_ts: number;
    quant: string;
    transaction_id: string;
    from_address: string;
  }>;
}

export async function getUSDTTransfers(
  address: string,
  hours: number = 3,
): Promise<Transfer[]> {
  const result: Transfer[] = [];
  const end = Date.now();
  const start = end - hours * 60 * 60 * 1000;

  const params = new URLSearchParams({
    limit: '300',
    start: '0',
    direction: 'in',
    relatedAddress: address,
    start_timestamp: start.toString(),
    end_timestamp: end.toString(),
  });

  try {
    const apiUrl = `https://apilist.tronscan.org/api/token_trc20/transfers?${params}`;
    const response = await fetch(apiUrl);
    const data: TransferResponse = await response.json();

    if (!data?.token_transfers) return result;

    for (const transfer of data.token_transfers) {
      if (
        transfer.to_address === address &&
        transfer.finalResult === 'SUCCESS'
      ) {
        result.push({
          time: transfer.block_ts / 1000,
          money: Number(transfer.quant) / 1_000_000, // USDT 有 6 位小数
          trade_id: transfer.transaction_id,
          buyer: transfer.from_address,
        });
      }
    }

    return result;
  } catch (error) {
    console.error('Error fetching USDT transfers:', error);
    return [];
  }
}

// 使用示例
async function checkReceipts() {
  const myAddress = 'TRX_WALLET_ADDRESS';
  const transfers = await getUSDTTransfers(myAddress);

  transfers.forEach((transfer) => {
    console.log(`收到 ${transfer.money} USDT，来自地址：${transfer.buyer}`);
    console.log(`交易时间：${new Date(transfer.time * 1000).toLocaleString()}`);
    console.log(`交易哈希：${transfer.trade_id}\n`);
  });
}
