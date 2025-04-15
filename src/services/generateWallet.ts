import { ethers } from 'ethers';
import { TronWeb } from 'tronweb';

const ethProvider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
const bscProvider = new ethers.JsonRpcProvider(
  'https://bsc-dataseed1.binance.org',
);
const tronWeb = new TronWeb({
  fullHost: 'https://api.trongrid.io',
});

interface WalletInfo {
  address: string;
  privateKey: string;
  balance: string;
}

// generateBnbWallet
export const createBnbWallet = async (): Promise<WalletInfo> => {
  // 生成新钱包
  const bnbWallet = ethers.Wallet.createRandom();

  // 获取钱包信息
  const walletInfo = {
    address: bnbWallet.address,
    privateKey: bnbWallet.privateKey,
  };

  // 获取实时余额
  const balance = await bscProvider.getBalance(walletInfo.address);
  const balanceInBnb = ethers.formatEther(balance);

  return {
    ...walletInfo,
    balance: balanceInBnb,
  };
};

export const createEthWallet = async () => {
  // 生成新钱包
  const ethWallet = ethers.Wallet.createRandom();

  // 获取钱包信息
  const walletInfo = {
    address: ethWallet.address,
    privateKey: ethWallet.privateKey,
  };

  // 获取实时余额
  const balance = await ethProvider.getBalance(walletInfo.address);
  const balanceInEth = ethers.formatEther(balance);

  return {
    ...walletInfo,
    balance: balanceInEth,
  };
};

export const createTrxWallet = async () => {
  // 生成新钱包
  const trxWallet = tronWeb.utils.accounts.generateAccount();

  // 获取钱包信息
  const walletInfo = {
    address: (trxWallet.address as any).base58,
    privateKey: trxWallet.privateKey,
  };

  // 获取实时余额
  const balanceInSun = await tronWeb.trx.getBalance(walletInfo.address);
  const balanceTRX = balanceInSun / 1000000; // Convert from SUN to TRX

  return {
    ...walletInfo,
    balance: balanceTRX,
  };
};
