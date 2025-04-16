import { getUsdtBalance } from '../../services/getBalance';
import Wallet from '../../models/wallet';
import chalk from 'chalk';
export const updateWalletUsdtBalance = async () => {
  const startTime = new Date();
  console.log(
    chalk.blue(`[${startTime.toISOString()}]`),
    chalk.cyan('开始执行更新钱包USDT余额任务'),
  );

  try {
    const wallets = await Wallet.find();
    console.log(
      chalk.blue(`[${new Date().toISOString()}]`),
      chalk.green('成功获取钱包列表，共'),
      chalk.yellow(`${wallets.length}`),
      chalk.green('个钱包需要更新'),
    );

    for (const wallet of wallets) {
      try {
        console.log(
          chalk.blue(`[${new Date().toISOString()}]`),
          chalk.cyan('正在更新钱包'),
          chalk.yellow(`${wallet.address}`),
          chalk.cyan(`(${wallet.network}) 的USDT余额`),
        );
        const balance = await getUsdtBalance(wallet.address, wallet.network);
        wallet.balance = Number(balance);
        await wallet.save();
        console.log(
          chalk.blue(`[${new Date().toISOString()}]`),
          chalk.green('钱包'),
          chalk.yellow(`${wallet.address}`),
          chalk.green('余额更新成功:'),
          chalk.yellow(`${balance}`),
          chalk.green('USDT'),
        );
      } catch (error) {
        console.error(
          chalk.blue(`[${new Date().toISOString()}]`),
          chalk.red('更新钱包'),
          chalk.yellow(`${wallet.address}`),
          chalk.red('余额失败:'),
          error,
        );
      }
    }

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;
    console.log(
      chalk.blue(`[${endTime.toISOString()}]`),
      chalk.green('钱包USDT余额更新任务完成，耗时'),
      chalk.yellow(`${duration}`),
      chalk.green('秒'),
    );
  } catch (error) {
    console.error(
      chalk.blue(`[${new Date().toISOString()}]`),
      chalk.red('更新钱包USDT余额任务失败:'),
      error,
    );
    throw error;
  }
};
