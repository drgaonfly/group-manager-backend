// src/controllers/accountAssignmentController.ts
import { Request, Response } from 'express';
import handleAsync from '../utils/handleAsync';
import AccountAssignment from '../models/accountAssignment';  // 确保路径正确
import { RequestCustom } from 'user';
import AccountLibrary from '../models/accountLibrary';
import AccountAssignmentRecord from '../models/accountAssignmentRecord';
import moment from 'moment-timezone';

export const createAssignment = handleAsync(async (req: RequestCustom, res: Response) => {
  // Set the assignedTime and isAssigned properties for each account in the account library list
  const accountLibraryList = req.body.accountLibraries;
  if (accountLibraryList && accountLibraryList.length > 0) {
    for (const accountLibraryId of accountLibraryList) {
      const accountLibrary = await AccountLibrary.findById(accountLibraryId);
      if (accountLibrary) {
        const record = new AccountAssignmentRecord({
          country: accountLibrary.country,
          platform: accountLibrary.platform,
          storeAccount: req.body.storeAccount,
          assignedTime: req.body.assignedTime.split(" ")[0],
          accountLibrary: accountLibrary._id,
          user: req.body.user || req.user._id,
        });
        await record.save();
      }
    }
  }

  res.status(201).json({ success: true });
});

export const getAllAssignments = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10', country, platform, numberOfAccounts, storeAccount, sorter, assignedTime } = req.query;

  const queryConditions: any = {};
  if (country) queryConditions.country = country;
  if (platform) queryConditions.platform = platform;
  if (numberOfAccounts) queryConditions.numberOfAccounts = numberOfAccounts;
  if (assignedTime) queryConditions.assignedTime = assignedTime;
  if (storeAccount) queryConditions.storeAccount = storeAccount;

  const currentNum = parseInt(current as string, 10);
  const pageSizeNum = parseInt(pageSize as string, 10);

  let sortCondition = '-createdAt'; // Default sort condition
  if (sorter) {
    const sorterObj = JSON.parse(sorter as string);
    if (sorterObj.assignedTime) {
      sortCondition = sorterObj.assignedTime === 'descend' ? '-assignedTime' : 'assignedTime';
    }
  }

  const total = await AccountAssignment.countDocuments(queryConditions);
  const assignments = await AccountAssignment.find(queryConditions)
    .populate("accountLibraries")
    .populate('user', '-password')
    .sort(sortCondition)
    .skip((currentNum - 1) * pageSizeNum)
    .limit(pageSizeNum);

  res.status(200).json({
    success: true,
    data: assignments,
    total,
    current: currentNum,
    pageSize: pageSizeNum
  });
});

export const getAssignmentById = handleAsync(async (req: Request, res: Response) => {
  const assignment = await AccountAssignment.findById(req.params.id);

  if (!assignment) {
    res.status(404)
    throw new Error('Assignment not found');
  }

  res.status(200).json({ success: true, data: assignment });
});

export const updateAssignment = handleAsync(async (req: Request, res: Response) => {
  const assignment = await AccountAssignment.findByIdAndUpdate(req.params.id, req.body, { new: true });

  if (!assignment) {
    res.status(404)
    throw new Error('Assignment not found');
  }

  res.status(200).json({ success: true, data: assignment });
});

export const deleteAssignment = handleAsync(async (req: Request, res: Response) => {
  const assignment = await AccountAssignment.findByIdAndDelete(req.params.id);

  if (!assignment) {
    res.status(404)
    throw new Error('Assignment not found');
  }

  res.status(200).json({ success: true, message: 'Assignment deleted successfully' });
});

export const deleteMultipleAssignments = handleAsync(async (req: Request, res: Response) => {
  const { ids } = req.body; // Array of assignment IDs to delete

  if (!ids || !ids.length) {
    res.status(400)
    throw new Error('No assignment IDs provided to delete');
  }

  const result = await AccountAssignment.deleteMany({ _id: { $in: ids } });

  if (result.deletedCount === 0) {
    res.status(404)
    throw new Error('No assignments found to delete');
  }

  res.json({ success: true, message: `${result.deletedCount} assignments deleted successfully` });
});


export const findAvailableAccounts = handleAsync(async (req: Request, res: Response) => {
  const { country, numberOfAccounts, platform, storeAccount, assignedTime } = req.body;


  const parsedDateTime = moment((assignedTime as string).replace(/"/g, ''));
  // 将日期对象转换为北京时间并格式化为年月日格式
  const assignedDate = parsedDateTime.tz("Asia/Shanghai").format('YYYY-MM-DD');

  // 从 AccountLibrary 表中取出所有的 accountLibrary
  const allAccounts = await AccountLibrary.find({
    country,
    platform,
    isAbnormal: false
  });

  const allAccountLibraries = allAccounts.map(account => account._id.toString());
  console.log("allAccountLibraries", allAccountLibraries)

  // 从 AccountAssignmentRecord 表中取出已分配的 accountLibrary
  const assignedRecords = await AccountAssignmentRecord.find({
    storeAccount,
    assignedTime: assignedDate
  });


  // 将取出的 accountLibrary 形成一个数组
  const assignedAccountLibraries = assignedRecords.map(record => record.accountLibrary.toString());
  console.log("assignedAccountLibraries", assignedAccountLibraries)

  // 去掉已分配的 accountLibrary
  const availableAccountLibraries = allAccountLibraries.filter(library => !assignedAccountLibraries.includes(library));

  console.log("availableAccountLibraries", availableAccountLibraries)

  // 使用 availableAccountLibraries 去查询 AccountLibrary 表，并限制结果数量为 numberOfAccounts
  const availableAccounts = await AccountLibrary.find({
    _id: { $in: availableAccountLibraries }
  }).limit(numberOfAccounts);

  // 返回查找到的账号
  res.status(200).json({
    success: true,
    data: availableAccounts
  });
});
