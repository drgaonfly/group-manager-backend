interface Transfer {
  time: number;
  money: number;
  trade_id: string;
  buyer: string;
  from_address: string;
  to_address: string;
  currency: string; // 货币类型字段，可能是TRX、USDT等
}

interface TrxTokenInfo {
  tokenAbbr?: string;
  tokenName?: string;
  tokenType?: string;
  amount?: number;
  toAddress?: string;
  ownerAddress?: string;
  contractRet?: string;
  hash?: string;
  timestamp?: number;
}

interface TrxTransaction {
  toAddress: string;
  ownerAddress: string;
  amount: number;
  hash: string;
  timestamp: number;
  contractRet: string;
  // 可能有tokenTransferInfo
  tokenTransferInfo?: TrxTokenInfo[];
  // 兼容部分接口返回
  tokenInfo?: {
    tokenAbbr?: string;
    tokenName?: string;
    tokenType?: string;
  };
  // 兼容部分接口返回的主币类型
  tokenAbbr?: string;
}

interface TrxResponse {
  data: TrxTransaction[];
}

/**
 * 查询指定地址在指定时间范围内的 TRX 转账记录（主币和token），支持分页+本地时间过滤
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
        // 主币或TRC10转账（不一定是TRX，可能是其它主币或TRC10）
        if (
          (tx.ownerAddress === address || tx.toAddress === address) &&
          tx.contractRet === 'SUCCESS' &&
          tx.timestamp >= start &&
          tx.timestamp <= end
        ) {
          if (seenTx.has(tx.hash)) continue;
          seenTx.add(tx.hash);

          // 判断主币类型
          // 优先使用 tokenAbbr 字段（部分接口返回），否则默认为 TRX
          let mainCurrency = 'TRX';
          if (tx.tokenAbbr) {
            mainCurrency = tx.tokenAbbr;
          } else if (tx.tokenInfo?.tokenAbbr) {
            mainCurrency = tx.tokenInfo.tokenAbbr;
          }

          const trxObj: Transfer = {
            time: tx.timestamp / 1000,
            money: tx.amount / 1_000_000,
            trade_id: tx.hash,
            buyer: tx.ownerAddress,
            from_address: tx.ownerAddress,
            to_address: tx.toAddress,
            currency: mainCurrency,
          };

          const isIncome = tx.toAddress === address;
          console.log(
            `[getTrxTransfers] ${isIncome ? '收到' : '发送'} ${
              trxObj.currency
            }: ${trxObj.money} ${trxObj.currency}, ${
              isIncome ? '来自' : '发往'
            }: ${isIncome ? trxObj.from_address : trxObj.to_address}, 哈希: ${
              trxObj.trade_id
            }, 时间: ${new Date(trxObj.time * 1000).toLocaleString()}`,
          );

          result.push(trxObj);
          validCount++;
        }

        // token转账（如USDT等）
        if (Array.isArray((tx as any).tokenTransferInfo)) {
          for (const tokenTx of (tx as any).tokenTransferInfo) {
            // 只处理和本地址相关的
            if (
              (tokenTx.ownerAddress === address ||
                tokenTx.toAddress === address) &&
              tokenTx.contractRet === 'SUCCESS' &&
              tokenTx.timestamp &&
              tokenTx.timestamp >= start &&
              tokenTx.timestamp <= end
            ) {
              const tokenHash = tokenTx.hash || tx.hash;
              if (seenTx.has(tokenHash)) continue;
              seenTx.add(tokenHash);

              // 兼容token精度
              let money = tokenTx.amount;
              // USDT等通常6位精度
              if (
                tokenTx.tokenAbbr === 'USDT' ||
                (tokenTx.tokenAbbr &&
                  tokenTx.tokenAbbr.toUpperCase() === 'USDT')
              ) {
                money = money / 1_000_000;
              } else if (
                tokenTx.tokenAbbr === 'USDD' ||
                (tokenTx.tokenAbbr &&
                  tokenTx.tokenAbbr.toUpperCase() === 'USDD')
              ) {
                money = money / 1_000_000;
              } else if (typeof money === 'number' && money > 1e12) {
                // 兜底，部分token可能18位
                money = money / 1e18;
              }

              // tokenAbbr 可能不存在，兜底用主交易的 tokenInfo 或 'TOKEN'
              let tokenCurrency =
                tokenTx.tokenAbbr || (tx.tokenInfo?.tokenAbbr ?? 'TOKEN');

              const tokenObj: Transfer = {
                time: (tokenTx.timestamp || tx.timestamp) / 1000,
                money,
                trade_id: tokenHash,
                buyer: tokenTx.ownerAddress,
                from_address: tokenTx.ownerAddress,
                to_address: tokenTx.toAddress,
                currency: tokenCurrency,
              };

              const isIncome = tokenObj.to_address === address;
              console.log(
                `[getTrxTransfers] ${isIncome ? '收到' : '发送'} ${
                  tokenObj.currency
                }: ${tokenObj.money} ${tokenObj.currency}, ${
                  isIncome ? '来自' : '发往'
                }: ${
                  isIncome ? tokenObj.from_address : tokenObj.to_address
                }, 哈希: ${tokenObj.trade_id}, 时间: ${new Date(
                  tokenObj.time * 1000,
                ).toLocaleString()}`,
              );

              result.push(tokenObj);
              validCount++;
            }
          }
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

  console.log(
    `[getTrxTransfers] 共获取到 ${result.length} 条 TRX/token 转账记录`,
  );
  return result;
}
