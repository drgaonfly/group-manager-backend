// src/controllers/accountLibraryController.ts
import { Request, Response } from 'express';
import handleAsync from '../utils/handleAsync';
import AccountLibrary, { IAccountLibrary } from '../models/accountLibrary';  // Updated import to use AccountLibrary model
import { RequestCustom } from 'user';
import { readAccountExcelData } from '../utils/processExcelFile';
import { mapCountryAndPlatform } from '../utils/mapCountryAndPlatform';
import * as XLSX from 'xlsx';
import { resolve } from 'path';
import ossClient from '../utils/oss';
import fs from "fs"
import { generateSignedUrl } from '../utils/generateSignedUrl';
import moment from 'moment-timezone';

export const createAccount = handleAsync(async (req: RequestCustom, res: Response) => {
  const accountData = new AccountLibrary({
    ...req.body,
    user: req.body.user || req.user._id,  // Assuming 'user' is authenticated and attached to req
  });

  const savedAccount = await accountData.save();
  res.status(201).json({ success: true, data: savedAccount });
});

export const getAllAccounts = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10', country, remark, platform, isAbnormal, loginAccount, accountNumber, createdAt, sorter } = req.query;

  const queryConditions: any = {};
  if (country) queryConditions.country = country;
  if (platform) queryConditions.platform = platform;
  if (remark) queryConditions.remark = new RegExp(String(remark), 'i');

  if (createdAt) {
    const date = new Date(createdAt as string); // Convert createdAt to a valid Date object
    const nextDate = new Date(date);
    nextDate.setDate(date.getDate() + 1);

    queryConditions.createdAt = {
      $gte: date.toISOString(),
      $lt: nextDate.toISOString()
    };
  }
  if (loginAccount) queryConditions.loginAccount = loginAccount;
  if (accountNumber) {
    const accountNumbers = (accountNumber as string).split(/[\s,]+/);  // Split the string by spaces and commas
    queryConditions.$or = accountNumbers.map(num => ({
      accountNumber: new RegExp(num.trim(), 'i')  // Create a regex for each accountNumber for fuzzy matching
    }));
  }
  if (typeof isAbnormal === 'string' && isAbnormal !== '') {
    queryConditions.isAbnormal = isAbnormal === 'true';  // Convert 'true'/'false' string from query to boolean
  }

  const currentNum = parseInt(current as string, 10);
  const pageSizeNum = parseInt(pageSize as string, 10);

  const total = await AccountLibrary.countDocuments(queryConditions);

  let sortCondition = '-createdAt'; // Default sort condition
  if (sorter) {
    const sorterObj = JSON.parse(sorter as string);
    if (sorterObj.createdAt) {
      sortCondition = sorterObj.createdAt === 'descend' ? '-createdAt' : 'createdAt';
    } else if (sorterObj.accountNumber) {
      sortCondition = sorterObj.accountNumber === 'descend' ? '-accountNumber' : 'accountNumber';
    } else if (sorterObj.updatedAt) {
      sortCondition = sorterObj.updatedAt === 'descend' ? '-updatedAt' : 'updatedAt';
    }
  }

  const accounts = await AccountLibrary.find(queryConditions)
    .populate('user', '-password')
    .sort(sortCondition)
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

export const exportAccountsToExcel = handleAsync(async (req: Request, res: Response) => {
  const { country, platform, isAbnormal, loginAccount, accountNumber, createdAt } = req.query;

  const queryConditions: any = {};
  if (country) queryConditions.country = country;
  if (platform) queryConditions.platform = platform;

  if (createdAt) {
    const parsedDateTime = moment((createdAt as string).replace(/"/g, ''));
    const beijingDateStart = parsedDateTime.tz("Asia/Shanghai").startOf('day').toDate();
    const beijingDateEnd = parsedDateTime.tz("Asia/Shanghai").endOf('day').toDate();

    queryConditions.createdAt = {
      $gte: beijingDateStart,
      $lt: beijingDateEnd
    };
  }
  if (loginAccount) queryConditions.loginAccount = loginAccount;
  if (accountNumber) queryConditions.accountNumber = accountNumber;
  if (typeof isAbnormal === 'string' && isAbnormal !== '') {
    queryConditions.isAbnormal = isAbnormal === 'true';  // Convert 'true'/'false' string from query to boolean
  }

  // Retrieve all accounts that match the query conditions
  const accounts = await AccountLibrary.find(queryConditions)
    .sort('-createdAt')
    .exec();

  const accountsPlainObjects = accounts.map((account: IAccountLibrary) => ({
    '国家': account.country,
    '平台': account.platform,
    '订单账号': account.accountNumber,
    '登录账号': account.loginAccount,
    '登录密码': account.loginPassword,
    '备注': account.remark,
    '异常': account.isAbnormal ? '是' : '否',
    '创建时间': account.createdAt,
  }));

  const ws = XLSX.utils.json_to_sheet(accountsPlainObjects);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Accounts");

  const timestamp = Date.now();
  const path = resolve('/tmp', `accounts-${timestamp}.xlsx`);
  XLSX.writeFile(wb, path);

  // Read the file into a buffer
  const buffer = fs.readFileSync(path);

  // Upload the file to OSS
  const newOssKey = `accounts-${timestamp}.xlsx`;
  await ossClient.put(newOssKey, buffer);

  // Clean up the temporary file
  fs.unlinkSync(path);

  // Generate the URL of the uploaded file
  const signedURL = await generateSignedUrl(newOssKey);

  res.json({
    success: true,
    data: { signedURL, file: newOssKey },
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
      const { country, platform } = mapCountryAndPlatform(account)

      return new AccountLibrary({
        country,
        platform,
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

export const updateAccountsBulk = handleAsync(async (req: RequestCustom, res: Response) => {
  const { ids, isAbnormal } = req.body;

  // 构建更新条件
  const filter = { _id: { $in: ids } };

  // Find all accounts that match the filter
  const accounts = await AccountLibrary.find(filter);

  // Update each account
  for (const account of accounts) {
    if (isAbnormal !== undefined && isAbnormal !== account.isAbnormal) {
      account.isAbnormal = isAbnormal;
    }

    // Save the account
    await account.save();
  }

  res.json({
    success: true,
    data: accounts,
  });
});

