import { getUsdtBalance } from '../../services/getBalance';
import Wallet from '../../models/wallet';

export const updateWalletUsdtBalance = async () => {
  const startTime = new Date();
  console.log(`[${startTime.toISOString()}] 开始执行更新钱包USDT余额任务`);

  try {
    const wallets = await Wallet.find();
    console.log(
      `[${new Date().toISOString()}] 成功获取钱包列表，共 ${
        wallets.length
      } 个钱包需要更新`,
    );

    for (const wallet of wallets) {
      try {
        console.log(
          `[${new Date().toISOString()}] 正在更新钱包 ${wallet.address} (${
            wallet.network
          }) 的USDT余额`,
        );
        const balance = await getUsdtBalance(wallet.address, wallet.network);
        wallet.balance = Number(balance);
        await wallet.save();
        console.log(
          `[${new Date().toISOString()}] 钱包 ${
            wallet.address
          } 余额更新成功: ${balance} USDT`,
        );
      } catch (error) {
        console.error(
          `[${new Date().toISOString()}] 更新钱包 ${wallet.address} 余额失败:`,
          error,
        );
      }
    }

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;
    console.log(
      `[${endTime.toISOString()}] 钱包USDT余额更新任务完成，耗时 ${duration} 秒`,
    );
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] 更新钱包USDT余额任务失败:`,
      error,
    );
    throw error;
  }
};
