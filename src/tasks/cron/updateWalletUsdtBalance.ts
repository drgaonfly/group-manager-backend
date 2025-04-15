import { getUsdtBalance } from '../../services/getBalance';
import Wallet from '../../models/wallet';

export const updateWalletUsdtBalance = async () => {
  const wallets = await Wallet.find();

  for (const wallet of wallets) {
    const balance = await getUsdtBalance(wallet.address, wallet.network);
    wallet.balance = Number(balance);
    await wallet.save();
  }
};
