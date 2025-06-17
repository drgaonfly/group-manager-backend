import { TronWeb } from 'tronweb';

const TRONGRID_API = 'https://api.trongrid.io';
const USDT_CONTRACT_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'; // 主网 USDT 合约

/**
 * 查询当前地址的 USDT 余额，并发送 TRX 到指定地址
 * @param fromPrivateKey 发起方私钥
 * @param toAddress TRX接收地址
 * @param trxAmount 发送的 TRX 数量
 */
export async function sendTRX(
  fromPrivateKey: string,
  toAddress: string,
  trxAmount: number,
): Promise<string> {
  const tronWeb = new TronWeb({
    fullHost: TRONGRID_API,
    privateKey: fromPrivateKey,
  });

  try {
    const fromAddress = tronWeb.address.fromPrivateKey(fromPrivateKey);

    // 验证地址格式
    if (!tronWeb.isAddress(toAddress)) {
      throw new Error('Invalid TRON address');
    }

    // 1. 检查是否收到 USDT
    const usdtContract = await tronWeb.contract().at(USDT_CONTRACT_ADDRESS);
    const usdtBalance = await usdtContract.balanceOf(fromAddress).call();
    const usdtBalanceFormatted = Number(usdtBalance.toString()) / 1_000_000;

    console.log(`USDT余额: ${usdtBalanceFormatted}`);

    if (usdtBalanceFormatted === 0) {
      throw new Error('未收到 USDT，无法进行 TRX 转账');
    }

    // 2. 确保有足够 TRX 发起交易
    const trxBalance = await tronWeb.trx.getBalance(fromAddress);
    if (trxBalance < trxAmount * 1_000_000) {
      throw new Error('TRX 余额不足，无法转账');
    }

    // 3. 发送 TRX
    const tx = await tronWeb.trx.sendTransaction(
      toAddress,
      trxAmount * 1_000_000,
    );
    console.log('发送交易成功:', tx.txid);
    return tx.txid;
  } catch (error) {
    console.error('操作失败:', error.message);
    throw new Error('接收 USDT 后发送 TRX 失败: ' + error.message);
  }
}
