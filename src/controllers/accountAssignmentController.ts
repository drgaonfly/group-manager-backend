// src/controllers/accountAssignmentController.ts
import { Request, Response } from 'express';
import handleAsync from '../utils/handleAsync';
import AccountAssignment from '../models/accountAssignment';  // 确保路径正确
import { RequestCustom } from 'user';
import AccountLibrary from '../models/accountLibrary';

export const createAssignment = handleAsync(async (req: RequestCustom, res: Response) => {
  // Get the current date and format it as YYYY-MM-DD
  const currentDate = new Date().toISOString().split('T')[0]; // This will give you a date string like "2024-04-03"

  const assignmentData = new AccountAssignment({
    ...req.body,
    assignedTime: currentDate, // Use the formatted date as the assigned time
    numberOfAccounts: req.body.accountLibraries.length,
    user: req.body.user || req.user._id, // Assuming 'user' is authenticated and attached to req
  });

  // Set the assignedTime and isAssigned properties for each account in the account library list
  const accountLibraryList = req.body.accountLibraries;
  if (accountLibraryList && accountLibraryList.length > 0) {
    assignmentData.accountLibraries = [];
    for (const accountLibraryId of accountLibraryList) {
      const accountLibrary = await AccountLibrary.findById(accountLibraryId);
      if (accountLibrary) {
        accountLibrary.assignedTime = currentDate;
        accountLibrary.isAssigned = true;
        await accountLibrary.save();
        assignmentData.accountLibraries.push(accountLibrary);
      }
    }
  }

  const savedAssignment = await assignmentData.save();
  res.status(201).json({ success: true, data: savedAssignment });
});

export const getAllAssignments = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10', country, platform, numberOfAccounts, storeAccount, assignedTime } = req.query;

  const queryConditions: any = {};
  if (country) queryConditions.country = country;
  if (platform) queryConditions.platform = platform;
  if (numberOfAccounts) queryConditions.numberOfAccounts = numberOfAccounts;
  if (assignedTime) queryConditions.assignedTime = assignedTime;
  if (storeAccount) queryConditions.storeAccount = storeAccount;

  const currentNum = parseInt(current as string, 10);
  const pageSizeNum = parseInt(pageSize as string, 10);

  const total = await AccountAssignment.countDocuments(queryConditions);
  const assignments = await AccountAssignment.find(queryConditions)
    .populate("accountLibraries")
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
  const { country, numberOfAccounts, platform } = req.body;

  // 查询满足条件且未分配的账号
  const availableAccounts = await AccountLibrary.aggregate([
    { $match: { country, platform, isAssigned: false } },
    { $sample: { size: numberOfAccounts } }
  ]);

  // 如果没有找到足够的账号，返回错误信息
  if (availableAccounts.length < numberOfAccounts) {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const accountsWithOldAssignments = await AccountLibrary.aggregate([
      { $match: { country, platform, isAssigned: false, assignedTime: { $lt: oneMonthAgo } } },
      { $sample: { size: numberOfAccounts - availableAccounts.length } }
    ]);
    availableAccounts.push(...accountsWithOldAssignments);
  }

  // 返回查找到的账号
  res.status(200).json({
    success: true,
    data: availableAccounts
  });
});

