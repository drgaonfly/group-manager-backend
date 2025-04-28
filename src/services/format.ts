import BigNumber from 'bignumber.js';

export const formatUSDT = (amount: number): number => {
  return new BigNumber(amount)
    .decimalPlaces(3, BigNumber.ROUND_DOWN)
    .toNumber();
};

export const formatETH = (amount: number): number => {
  return new BigNumber(amount)
    .decimalPlaces(6, BigNumber.ROUND_DOWN)
    .toNumber();
};
