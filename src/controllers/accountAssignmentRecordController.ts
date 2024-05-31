import { Request, Response } from 'express';
import AccountAssignmentRecord, { IAccountAssignmentRecord } from '../models/accountAssignmentRecord';
import handleAsync from '../utils/handleAsync';
import { RequestCustom } from 'user';
import { generateSignedUrl } from '../utils/generateSignedUrl';
import ossClient from '../utils/oss';
import { resolve } from 'path';
import XLSX from 'xlsx';
import fs from 'fs';
import AccountLibrary, { IAccountLibrary } from '../models/accountLibrary';
import { IUser } from '../models/user';
import { countryMapping } from '../constants';

// Create a new AccountAssignmentRecord
export const createAccountAssignmentRecord = handleAsync(async (req: RequestCustom, res: Response) => {
  const record: IAccountAssignmentRecord = new AccountAssignmentRecord({
    ...req.body,
    user: req.body.user || req.user._id, //
  });
  const savedRecord = await record.save();
  res.status(201).json({ success: true, data: savedRecord });
});

// Get all AccountAssignmentRecords
export const getAllAccountAssignmentRecords = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10', country, platform, storeAccount, assignedTime, accountNumber, loginAccount } = req.query;

  const queryConditions: any = {};
  if (country) queryConditions.country = country;
  if (platform) queryConditions.platform = platform;
  if (assignedTime) queryConditions.assignedTime = assignedTime;
  if (storeAccount) queryConditions.storeAccount = storeAccount;

  if (accountNumber) {
    // Find the accountLibrary with the given accountNumber
    const accountLibrary = await AccountLibrary.findOne({ accountNumber: accountNumber });
    if (accountLibrary) {
      // If found, use its _id in the query conditions
      queryConditions.accountLibrary = accountLibrary._id;
    } else {
      res.status(200).json({ success: true, data: [], total: 0 });
      return;
    }
  }

  if (loginAccount) {
    // Find the accountLibrary with the given accountNumber
    const accountLibrary = await AccountLibrary.findOne({ loginAccount: loginAccount });
    if (accountLibrary) {
      // If found, use its _id in the query conditions
      queryConditions.accountLibrary = accountLibrary._id;
    } else {
      res.status(200).json({ success: true, data: [], total: 0 });
      return;
    }
  }

  const currentNum = parseInt(current as string, 10);
  const pageSizeNum = parseInt(pageSize as string, 10);

  const total = await AccountAssignmentRecord.countDocuments(queryConditions);
  const records = await AccountAssignmentRecord.find(queryConditions)
    .populate('user', '-password')
    .populate('accountLibrary')
    .sort('-createdAt')
    .skip((currentNum - 1) * pageSizeNum)
    .limit(pageSizeNum)

  res.status(200).json({
    success: true,
    data: records,
    total,
    current: currentNum,
    pageSize: pageSizeNum
  });
});

// Get a single AccountAssignmentRecord by ID
export const getAccountAssignmentRecordById = handleAsync(async (req: Request, res: Response) => {
  const record = await AccountAssignmentRecord.findById(req.params.id);
  if (!record) {
    res.status(404);
    throw new Error('Record not found');
  }
  res.status(200).json({ success: true, data: record });
});

// Update an AccountAssignmentRecord by ID
export const updateAccountAssignmentRecord = handleAsync(async (req: Request, res: Response) => {
  const record = await AccountAssignmentRecord.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!record) {
    res.status(404);
    throw new Error('Record not found');
  }
  res.status(200).json({ success: true, data: record });
});

// Delete an AccountAssignmentRecord by ID
export const deleteAccountAssignmentRecord = handleAsync(async (req: Request, res: Response) => {
  const record = await AccountAssignmentRecord.findByIdAndDelete(req.params.id);
  if (!record) {
    res.status(404);
    throw new Error('Record not found');
  }
  res.status(200).json({ success: true, data: {} });
});

export const exportAccountAssignmentRecordsToExcel = handleAsync(async (req: Request, res: Response) => {
  const { country, platform, storeAccount, assignedTime } = req.query;

  const queryConditions: any = {};
  if (country) {
    queryConditions.country = country;
  }
  if (platform) {
    queryConditions.platform = platform;
  }
  if (assignedTime) {
    queryConditions.assignedTime = assignedTime;
  }
  if (storeAccount) {
    queryConditions.storeAccount = storeAccount;
  }

  const records = await AccountAssignmentRecord.find(queryConditions)
    .populate("user")
    .populate("accountLibrary")
    .exec();

  const countryMappingReverse = Object.fromEntries(Object.entries(countryMapping).map(([key, value]) => [value, key]));

  const recordsPlainObjects = await Promise.all(records.map(async (record: IAccountAssignmentRecord) => {
    return {
      '国家': countryMappingReverse[record.country],
      '平台': record.platform,
      '店铺账号': record.storeAccount,
      '账号库账号': (record.accountLibrary as IAccountLibrary)?.accountNumber,
      '账号库登录账号': (record.accountLibrary as IAccountLibrary)?.loginAccount,
      '账号库登录密码': (record.accountLibrary as IAccountLibrary)?.loginPassword,
      '分配时间': record.assignedTime,
      '操作员': (record.user as IUser)?.name,
    };
  }));

  const ws = XLSX.utils.json_to_sheet(recordsPlainObjects);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "AccountAssignmentRecords");

  const timestamp = Date.now();
  const path = resolve('/tmp', `accountAssignmentRecords-${timestamp}.xlsx`);
  XLSX.writeFile(wb, path);

  const buffer = fs.readFileSync(path);

  const newOssKey = `accountAssignmentRecords-${timestamp}.xlsx`;
  await ossClient.put(newOssKey, buffer);

  fs.unlinkSync(path);

  const signedURL = await generateSignedUrl(newOssKey);

  res.json({
    success: true,
    data: { signedURL, file: newOssKey },
  });
});