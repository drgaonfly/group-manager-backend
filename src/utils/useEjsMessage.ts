import ejs from 'ejs';
import path from 'path';

export const useSummary = () => {
  return async (data: {
    deposits: any[];
    withdraws: any[];
    feeRate: number;
    exchangeRate: number;
    unit?: string;
  }) => {
    const templatePath = path.join(__dirname, '../templates/summary.ejs');

    return await ejs.renderFile(templatePath, data);
  };
};
