// src/controllers/accountLibraryController.ts
import { Request, Response } from 'express';
import handleAsync from '../utils/handleAsync';
import AccountLibrary from '../models/accountLibrary';  // Updated import to use AccountLibrary model
import { RequestCustom } from 'user';

export const createAccount = handleAsync(async (req: RequestCustom, res: Response) => {
  const accountData = new AccountLibrary({
    ...req.body,
    user: req.body.user || req.user._id,  // Assuming 'user' is authenticated and attached to req
  });

  const savedAccount = await accountData.save();
  res.status(201).json({ success: true, data: savedAccount });
});

export const getAllAccounts = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10', country, platform, address, accountNumber } = req.query;

  const queryConditions: any = {};
  if (country) queryConditions.country = country;
  if (platform) queryConditions.platform = platform;
  if (address) queryConditions.address = address;
  if (accountNumber) queryConditions.accountNumber = accountNumber;

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
    res.status(404).send({ success: false, message: 'Account not found' });
    return;
  }

  res.status(200).json({ success: true, data: account });
});

export const updateAccount = handleAsync(async (req: Request, res: Response) => {
  const account = await AccountLibrary.findByIdAndUpdate(req.params.id, req.body, { new: true });

  if (!account) {
    res.status(404).send({ success: false, message: 'Account not found' });
    return;
  }

  res.status(200).json({ success: true, data: account });
});

export const deleteAccount = handleAsync(async (req: Request, res: Response) => {
  const account = await AccountLibrary.findByIdAndDelete(req.params.id);

  if (!account) {
    res.status(404).send({ success: false, message: 'Account not found' });
    return;
  }

  res.status(200).json({ success: true, message: 'Account deleted successfully' });
});

export const deleteMultipleAccounts = handleAsync(async (req: Request, res: Response) => {
  const { ids } = req.body; // Array of account IDs to delete

  if (!ids || !ids.length) {
    res.status(400).send({ success: false, message: 'No account IDs provided to delete' });
    return;
  }

  const result = await AccountLibrary.deleteMany({ _id: { $in: ids } });

  if (result.deletedCount === 0) {
    res.status(404).send({ success: false, message: 'No accounts found to delete' });
    return;
  }

  res.json({ success: true, message: `${result.deletedCount} accounts deleted successfully` });
});
