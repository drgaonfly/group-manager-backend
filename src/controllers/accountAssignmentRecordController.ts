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

export const deleteMultipleAssignmentRecords = handleAsync(async (req: Request, res: Response) => {
  const { ids } = req.body; // Array of assignment record IDs to delete

  if (!ids || !ids.length) {
    res.status(400);
    throw new Error('No assignment record IDs provided to delete');
  }

  const result = await AccountAssignmentRecord.deleteMany({ _id: { $in: ids } });

  if (result.deletedCount === 0) {
    res.status(404).send({ success: false, message: 'No assignment records found to delete' });
    return;
  }

  res.json({ success: true, message: `${result.deletedCount} assignment records deleted successfully` });
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

  // Group records by account library
  const groupedRecords = records.reduce((groups, record) => {
    if (!record.accountLibrary) {
      return groups;
    }

    const key = (record.accountLibrary as IAccountLibrary)._id.toString();
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(record);
    return groups;
  }, {} as Record<string, IAccountAssignmentRecord[]>);

  console.log(groupedRecords)

  const groupLengths = [];
  for (const key in groupedRecords) {
    const groupLength = groupedRecords[key].length;
    groupLengths.push(groupLength);
  }

  const maxGroupLength = Math.max(...groupLengths);

  console.log(maxGroupLength); // This will print the maximum length of the arrays in groupedRecordshis will print the maximum length of the arrays in groupedRecords
  // Process each group of records
  const recordsPlainObjects = await Promise.all(Object.entries(groupedRecords).map(async ([_, group]) => {
    const baseFields = {
      '国家': countryMappingReverse[group[0].country],
      '平台': group[0].platform,
      '账号库账号': (group[0].accountLibrary as IAccountLibrary)?.accountNumber,
      '账号库登录账号': (group[0].accountLibrary as IAccountLibrary)?.loginAccount,
      '账号库登录密码': (group[0].accountLibrary as IAccountLibrary)?.loginPassword,
      '': ''
    };

    const headers = Array.from({ length: maxGroupLength }, (_, index) => {
      return {
        [`店铺账号${index + 1}`]: group[index]?.storeAccount || '',
        [`分配时间${index + 1}`]: group[index]?.assignedTime || '',
        [`操作员${index + 1}`]: (group[index]?.user as IUser)?.name || '',
      };
    }).reduce((prev, curr) => ({ ...prev, ...curr }), {});

    console.log(headers); // This will print the headers

    return {
      ...baseFields,
      ...headers,
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