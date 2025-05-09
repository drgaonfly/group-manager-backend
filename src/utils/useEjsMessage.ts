import ejs from 'ejs';

export const useSummary = () => {
  return async (data: {
    title: string;
    depositTimes: number;
    widthdrawTimes: number;
    deposits: any[];
    widthdraws: any[];
    feeRate: number;
    exchangeRate: number;
    unit?: string;
  }) => {
    return await ejs.renderFile('../templates/summary.ejs', data);
  };
};

export const useDeposit = () => {
  return async (data: {
    title: string;
    depositTimes: number;
    deposits: any[];
    feeRate: number;
    exchangeRate: number;
    unit?: string;
  }) => {
    return await ejs.renderFile('../templates/deposit.ejs', data);
  };
};

export const useWithdraw = () => {
  return async (data: {
    title: string;
    widthdrawTimes: number;
    widthdraws: any[];
    feeRate: number;
    exchangeRate: number;
    unit?: string;
  }) => {
    return await ejs.renderFile('../templates/withdraw.ejs', data);
  };
};
