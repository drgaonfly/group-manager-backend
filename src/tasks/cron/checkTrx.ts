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

/**
 * 查询指定地址在指定时间范围内的 USDT 转账（支持自动分页，防止漏单）
 * @param address 查询的地址
 * @param minutes 查询的分钟数（默认15分钟）
 * @param maxPages 最大分页数，防止死循环（默认3页）
 * @param pageSize 每页条数（默认100，最大300）
 * @param minIntervalMs 每次请求间隔，防止频率过高（默认500ms）
 */
export async function getUSDTTransfers(
  address: string,
  minutes: number = process.env.NODE_ENV === 'development' ? 5 * 24 * 60 : 15,
  maxPages: number = 3,
  pageSize: number = 100,
  minIntervalMs: number = 500,
): Promise<Transfer[]> {
  const result: Transfer[] = [];
  const end = Date.now();
  const start = end - minutes * 60 * 1000;
  let page = 0;
  let fetchedAll = false;

  // 记录已出现过的交易哈希，防止分页重复
  const seenTx = new Set<string>();

  while (!fetchedAll && page < maxPages) {
    const params = new URLSearchParams({
      limit: String(pageSize),
      start: String(page * pageSize),
      direction: 'in',
      relatedAddress: address,
      start_timestamp: start.toString(),
      end_timestamp: end.toString(),
    });

    const apiUrl = `https://apilist.tronscan.org/api/token_trc20/transfers?${params}`;
    console.log(`[getUSDTTransfers] 请求地址: ${apiUrl}`);

    try {
      const response = await fetch(apiUrl);
      const data: TransferResponse = await response.json();

      if (!data?.token_transfers || data.token_transfers.length === 0) {
        console.log(
          `[getUSDTTransfers] 第${page + 1}页无更多转账记录，提前结束`,
        );
        break;
      }

      let validCount = 0;
      for (const transfer of data.token_transfers) {
        if (
          transfer.to_address === address &&
          transfer.finalResult === 'SUCCESS'
        ) {
          if (seenTx.has(transfer.transaction_id)) continue;
          seenTx.add(transfer.transaction_id);

          const transferObj: Transfer = {
            time: transfer.block_ts / 1000,
            money: Number(transfer.quant) / 1_000_000, // USDT 有 6 位小数
            trade_id: transfer.transaction_id,
            buyer: transfer.from_address,
          };
          console.log(
            `[getUSDTTransfers] 收到转账: ${transferObj.money} USDT, 来自: ${
              transferObj.buyer
            }, 交易哈希: ${transferObj.trade_id}, 时间: ${new Date(
              transferObj.time * 1000,
            ).toLocaleString()}`,
          );
          result.push(transferObj);
          validCount++;
        }
      }

      // 如果本页返回数量小于pageSize，说明已无更多数据
      if (data.token_transfers.length < pageSize) {
        fetchedAll = true;
      }

      // 如果本页没有有效数据，也提前结束
      if (validCount === 0 && data.token_transfers.length < pageSize) {
        break;
      }

      page++;
      // 控制请求频率
      if (minIntervalMs > 0 && page < maxPages) {
        await new Promise((res) => setTimeout(res, minIntervalMs));
      }
    } catch (error) {
      console.error(`[getUSDTTransfers] 第${page + 1}页请求失败:`, error);
      break;
    }
  }

  console.log(`[getUSDTTransfers] 共获取到 ${result.length} 条有效转账记录`);
  return result;
}

// 调用用例
// getUSDTTransfers('TT7uDJS5gtDya3hfSHPcSEUFHaPLhsxVtf');
