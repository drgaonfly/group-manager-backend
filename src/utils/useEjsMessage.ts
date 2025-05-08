import ejs from 'ejs';
import path from 'path';

export const useSummary = () => {
  return async (data: {
    title: string;
    depositTimes: number;
    widthdrawTimes: number;
    deposits: any[];
    widthdraws: any[];
    feeRate: number;
    exchangeRate: number;
  }) => {
    const templatePath = path.join(__dirname, '../templates/summary.ejs');

    return await ejs.renderFile(templatePath, data);
  };
};
