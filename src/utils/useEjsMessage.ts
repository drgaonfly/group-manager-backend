import ejs from 'ejs';
import path from 'path';
import { IBotUserConfig } from '../models/botUserConfig';

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

export const useCustomerService = () => {
  return async (data: { url: string; channel: string; group: string }) => {
    const templatePath = path.join(
      __dirname,
      '../templates/customerService.ejs',
    );
    return await ejs.renderFile(templatePath, data);
  };
};

// 创建用户资料模板渲染函数
export const useUserProfile = () => {
  return async (data: {
    userId: string;
    userName: string;
    nickname: string;
    registerDate: string;
    currentBalance: number;
    botUserConfig: IBotUserConfig;
    currentPlan: string;
  }) => {
    const templatePath = path.join(__dirname, '../templates/userProfile.ejs');
    return await ejs.renderFile(templatePath, data);
  };
};

export const useRenewal = () => {
  return async () => {
    const templatePath = path.join(__dirname, '../templates/renewal.ejs');
    return await ejs.renderFile(templatePath);
  };
};
