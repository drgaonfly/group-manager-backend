// src/controllers/accountLibraryController.ts
import { Request, Response } from 'express';
import handleAsync from '../utils/handleAsync';
import AccountLibrary from '../models/accountLibrary';  // Updated import to use AccountLibrary model
import { RequestCustom } from 'user';
import { readAccountExcelData } from '../utils/processExcelFile';
import { countryMapping, platformMapping } from '../constants';

export const createAccount = handleAsync(async (req: RequestCustom, res: Response) => {
  const accountData = new AccountLibrary({
    ...req.body,
    user: req.body.user || req.user._id,  // Assuming 'user' is authenticated and attached to req
  });

  const savedAccount = await accountData.save();
  res.status(201).json({ success: true, data: savedAccount });
});

export const getAllAccounts = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10', country, platform, loginAccount, accountNumber, assignedTime } = req.query;

  const queryConditions: any = {};
  if (country) queryConditions.country = country;
  if (platform) queryConditions.platform = platform;
  if (loginAccount) queryConditions.loginAccount = loginAccount;
  if (accountNumber) queryConditions.accountNumber = accountNumber;
  if (assignedTime) queryConditions.assignedTime = assignedTime;

  const currentNum = parseInt(current as string, 10);
  const pageSizeNum = parseInt(pageSize as string, 10);

  const total = await AccountLibrary.countDocuments(queryConditions);
  const accounts = await AccountLibrary.find(queryConditions)
    .skip((currentNum - 1) * pageSizeNum)
    .limit(pageSizeNum);

  res.status(200).json({
    success: true,
    data: accounts,
    total,
    current: currentNum,
    pageSize: pageSizeNum
  });
});

export const getAccountById = handleAsync(async (req: Request, res: Response) => {
  const account = await AccountLibrary.findById(req.params.id);

  if (!account) {
    res.status(404)
    throw new Error('Account not found');
  }

  res.status(200).json({ success: true, data: account });
});

export const updateAccount = handleAsync(async (req: Request, res: Response) => {
  const account = await AccountLibrary.findByIdAndUpdate(req.params.id, req.body, { new: true });

  if (!account) {
    res.status(404)
    throw new Error('Account not found');
  }

  res.status(200).json({ success: true, data: account });
});

export const deleteAccount = handleAsync(async (req: Request, res: Response) => {
  const account = await AccountLibrary.findByIdAndDelete(req.params.id);

  if (!account) {
    res.status(404)
    throw new Error('Account not found');
  }

  res.status(200).json({ success: true, message: 'Account deleted successfully' });
});

export const deleteMultipleAccounts = handleAsync(async (req: Request, res: Response) => {
  const { ids } = req.body; // Array of account IDs to delete

  if (!ids || !ids.length) {
    res.status(400)
    throw new Error('No account IDs provided to delete');
  }

  const result = await AccountLibrary.deleteMany({ _id: { $in: ids } });

  if (result.deletedCount === 0) {
    res.status(404).send({ success: false, message: 'No accounts found to delete' });
    return;
  }

  res.json({ success: true, message: `${result.deletedCount} accounts deleted successfully` });
});



export const uploadAccountLibrary = handleAsync(async (req: RequestCustom, res: Response) => {
  const file = req.body.file;
 
  if (!file) {
    res.status(400)
    throw new Error('File not provided in the request body');
  }

  const accountData = await readAccountExcelData(file);

  // Save each account to the database
  const savedAccounts = await Promise.all(
    accountData.map((account) => {
      let mappedCountry = account.country.trim();
      
      const standardPlatform = account.platform.toLowerCase().replace(/^\w/, c => c.toUpperCase());
      const mappedPlatform = platformMapping[standardPlatform];

      // 处理传入数据中的特定地区名称
      if (account.country.includes('河内')) {
        mappedCountry = '越南河内';
      } else if (account.country.includes('胡志明')) {
        mappedCountry = '越南胡志明';
      }

      // 使用countryMapping对象进行映射
      Object.keys(countryMapping).forEach((region) => {
        if (mappedCountry.includes(region)) {
          mappedCountry = countryMapping[region as keyof typeof countryMapping];
        }
      });
  
      return new AccountLibrary({
        country: mappedCountry,
        platform: mappedPlatform ? mappedPlatform : account.platform,
        accountNumber: account.accountNumber,
        loginAccount: account.loginAccount,
        loginPassword: account.loginPassword,
        user: req.user._id
      }).save();
    })
  );
  const accountIds = savedAccounts.map(account => account._id);

  res.json({
    success: true,
    message: 'Account library saved successfully',
    data: accountIds
  });
});