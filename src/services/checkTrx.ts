interface Transfer {
  time: number;
  money: number;
  trade_id: string;
  buyer: string;
  from_address: string;
  to_address: string;
}

interface TrxTransaction {
  toAddress: string;
  ownerAddress: string;
  amount: number;
  hash: string;
  timestamp: number;
  contractRet: string;
}

interface TrxResponse {
  data: TrxTransaction[];
}

/**
 * 查询指定地址在指定时间范围内的 TRX 转账记录（主币），支持分页+本地时间过滤
 * @param address 查询的地址
 * @param minutes 查询的分钟数（默认15分钟）
 * @param maxPages 最大分页数，防止死循环（默认3页）
 * @param pageSize 每页条数（默认50）
 * @param minIntervalMs 请求间隔（默认500ms）
 */
export async function getTrxTransfers(
  address: string,
  minutes: number = process.env.NODE_ENV === 'development' ? 5 * 24 * 60 : 15,
  maxPages: number = 3,
  pageSize: number = 50,
  minIntervalMs: number = 500,
): Promise<Transfer[]> {
  const result: Transfer[] = [];
  const end = Date.now();
  const start = end - minutes * 60 * 1000;
  let page = 0;
  let fetchedAll = false;

  const seenTx = new Set<string>();

  while (!fetchedAll && page < maxPages) {
    const params = new URLSearchParams({
      address,
      limit: String(pageSize),
      start: String(page * pageSize),
      sort: 'timestamp',
    });

    const apiUrl = `https://apilist.tronscan.org/api/transaction?${params}`;
    console.log(`[getTrxTransfers] 请求地址: ${apiUrl}`);

    try {
      const response = await fetch(apiUrl);
      const data: TrxResponse = await response.json();

      if (!data?.data || data.data.length === 0) {
        console.log(
          `[getTrxTransfers] 第${page + 1}页无更多转账记录，提前结束`,
        );
        break;
      }

      let validCount = 0;
      for (const tx of data.data) {
        if (
          (tx.ownerAddress === address || tx.toAddress === address) &&
          tx.contractRet === 'SUCCESS' &&
          typeof tx.amount === 'string' &&
          tx.timestamp >= start &&
          tx.timestamp <= end
        ) {
          if (seenTx.has(tx.hash)) continue;
          seenTx.add(tx.hash);

          const trxObj: Transfer = {
            time: tx.timestamp / 1000,
            money: tx.amount / 1_000_000,
            trade_id: tx.hash,
            buyer: tx.ownerAddress,
            from_address: tx.ownerAddress,
            to_address: tx.toAddress,
          };

          const isIncome = tx.toAddress === address;
          console.log(
            `[getTrxTransfers] ${isIncome ? '收到' : '发送'} TRX: ${
              trxObj.money
            } TRX, ${isIncome ? '来自' : '发往'}: ${
              isIncome ? trxObj.from_address : trxObj.to_address
            }, 哈希: ${trxObj.trade_id}, 时间: ${new Date(
              trxObj.time * 1000,
            ).toLocaleString()}`,
          );

          result.push(trxObj);
          validCount++;
        }
      }

      if (data.data.length < pageSize || validCount === 0) {
        fetchedAll = true;
      }

      page++;
      if (minIntervalMs > 0 && page < maxPages) {
        await new Promise((res) => setTimeout(res, minIntervalMs));
      }
    } catch (error) {
      console.error(`[getTrxTransfers] 第${page + 1}页请求失败:`, error);
      break;
    }
  }

  console.log(`[getTrxTransfers] 共获取到 ${result.length} 条 TRX 转账记录`);
  return result;
}
