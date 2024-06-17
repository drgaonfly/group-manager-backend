// src/controllers/emptyPackageController.ts
import { Request, Response } from 'express';
import handleAsync from '../utils/handleAsync';
import EmptyPackage from '../models/emptyPackage';  // Updated import to use EmptyPackage model
import { RequestCustom } from 'user';
import { transformDocumentImages } from '../utils/transformUtils';
import XLSX from 'xlsx';
import fs from 'fs';
import { resolve } from 'path';
import User, { IUser } from '../models/user'; // Assuming you have this interface
import { IEmptyPackage } from '../models/emptyPackage'; // Assuming you have this interface
import { generateSignedUrl } from '../utils/generateSignedUrl';
import { countryMapping } from '../constants';
import ossClient from '../utils/oss';
import { ROLES } from '../constants';

export const createEmptyPackage = handleAsync(async (req: RequestCustom, res: Response) => {
  const { uploadTime } = req.body

  if (uploadTime) {
    const dateMatch = uploadTime.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      req.body.uploadTime = dateMatch[0]; // 如果找到匹配项，则只保留年月日
    }
  }
  const user = await User.findById(req.body.user) || req.user;

  // 获取这个客户在指定日期上传的空包数量
  const count = await EmptyPackage.countDocuments({ user: user._id, uploadTime: req.body.uploadTime });

  // 生成空包编码
  const uploadDate = new Date(req.body.uploadTime);

  // 获取年、月和日
  const year = uploadDate.getFullYear().toString().substr(-2); // 获取年份的最后两位
  const month = (uploadDate.getMonth() + 1).toString().padStart(2, '0'); // 获取月份并确保它是两位数
  const day = uploadDate.getDate().toString().padStart(2, '0'); // 获取日期并确保它是两位数

  // 生成空包编码
  req.body.code = `${year}${month}${day}${user.name}KB(${count + 1})`;

  const emptyPackageData = new EmptyPackage({
    ...req.body,
    user: user._id,
  });

  const savedEmptyPackage = await emptyPackageData.save();
  res.status(201).json({ success: true, data: savedEmptyPackage });
});

export const getAllEmptyPackages = handleAsync(async (req: RequestCustom, res: Response) => {
  // Extracting pagination and filter parameters or providing default values
  const { current = '1', pageSize = '10', code, isProcessed, uploadTime, country, _id, platform, user } = req.query;

  const queryConditions: any = {};
  if (country) {
    queryConditions.country = country;
  }
  if (uploadTime) {
    queryConditions.uploadTime = uploadTime;
  }
  if (platform) {
    queryConditions.platform = platform;
  }
  if (typeof isProcessed === 'string' && isProcessed !== '') {
    queryConditions.isProcessed = isProcessed === 'true';  // Convert 'true'/'false' string from query to boolean
  }
  if (_id) {
    queryConditions._id = _id;
  }
  if (code) {
    queryConditions.code = code;
  }
  if (req.user.role !== ROLES.Admin && req.user.role !== ROLES.SuperAdmin) {
    queryConditions.name = req.user.role;
  }

  if (req.user.role === ROLES.Customer) {
    queryConditions.user = req.user._id;
  }

  if (user) {
    const foundUser = await User.findOne({ name: user });
    if (foundUser) {
      queryConditions.user = foundUser._id;
    }
  }

  // Convert current and pageSize to numbers to use in skip and limit
  const currentNum = parseInt(current as string, 10);
  const pageSizeNum = parseInt(pageSize as string, 10);

  // Count total empty packages matching the query conditions for pagination
  const total = await EmptyPackage.countDocuments(queryConditions);

  // Fetching empty packages with pagination applied
  const emptyPackages = await EmptyPackage.find(queryConditions)
    .populate('user', '-password')
    .sort('-createdAt')  // Add this line to sort by creation time in descending order
    .skip((currentNum - 1) * pageSizeNum)
    .limit(pageSizeNum);

  const modifiedEmptyPackages = await transformDocumentImages(emptyPackages, ['file']);

  // Returning the paginated empty packages along with pagination details
  res.status(200).json({
    success: true,
    data: modifiedEmptyPackages,
    total,
    current: currentNum,
    pageSize: pageSizeNum
  });
});


export const getEmptyPackageById = handleAsync(async (req: Request, res: Response) => {
  const emptyPackage = await EmptyPackage.findById(req.params.id);

  if (!emptyPackage) {
    res.status(404)
    throw new Error('Empty package not found');
  }

  res.status(200).json({ success: true, data: emptyPackage });
});

export const updateEmptyPackage = handleAsync(async (req: Request, res: Response) => {
  // 检查是否有uploadTime传入，并用正则表达式提取年月日部分
  if (req.body.uploadTime) {
    const dateMatch = req.body.uploadTime.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      req.body.uploadTime = dateMatch[0]; // 如果找到匹配项，则只保留年月日
    }
  }

  const update = { ...req.body };
  delete update.file;

  const emptyPackage = await EmptyPackage.findByIdAndUpdate(req.params.id, update, { new: true });

  if (!emptyPackage) {
    res.status(404)
    throw new Error('Empty package not found');
  }

  res.status(200).json({ success: true, data: emptyPackage });
});

export const deleteEmptyPackage = handleAsync(async (req: Request, res: Response) => {
  const emptyPackage = await EmptyPackage.findByIdAndDelete(req.params.id);

  if (!emptyPackage) {
    res.status(404)
    throw new Error('Empty package not found');
  }

  res.status(200).json({ success: true, message: 'Empty package deleted successfully' });
});

export const deleteMultipleEmptyPackages = handleAsync(async (req: Request, res: Response) => {
  const { ids } = req.body; // Array of empty package IDs to delete

  if (!ids || !ids.length) {
    res.status(400)
    throw new Error('No empty package IDs provided to delete');
  }

  const result = await EmptyPackage.deleteMany({ _id: { $in: ids } });

  if (result.deletedCount === 0) {
    res.status(404)
    throw new Error('No empty packages found to delete');
  }

  res.json({ success: true, message: `${result.deletedCount} empty packages deleted successfully` });
});


export const exportEmptyPackagesToExcel = handleAsync(async (req: Request, res: Response) => {
  const { isProcessed, country, _id, platform } = req.query;

  const queryConditions: any = {};
  if (country) {
    queryConditions.country = country;
  }
  if (platform) {
    queryConditions.platform = platform;
  }
  if (typeof isProcessed === 'string' && isProcessed !== '') {
    queryConditions.isProcessed = isProcessed === 'true';  // Convert 'true'/'false' string from query to boolean
  }
  if (_id) {
    queryConditions._id = _id;
  }

  const emptyPackages = await EmptyPackage.find(queryConditions)
    .populate("user")
    .exec();

  const countryMappingReverse = Object.fromEntries(Object.entries(countryMapping).map(([key, value]) => [value, key]));

  const emptyPackagesPlainObjects = await Promise.all(emptyPackages.map(async (emptyPackage: IEmptyPackage) => {
    return {
      '编号': emptyPackage.code,
      '国家': countryMappingReverse[emptyPackage.country],
      '平台': emptyPackage.platform,
      '上传用户': (emptyPackage.user as IUser)?.name,
      '单量': emptyPackage.quantity,
      '是否处理': emptyPackage.isProcessed ? '是' : '否',
    };
  }));

  const ws = XLSX.utils.json_to_sheet(emptyPackagesPlainObjects);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "EmptyPackages");

  const timestamp = Date.now();
  const path = resolve('/tmp', `emptyPackages-${timestamp}.xlsx`);
  XLSX.writeFile(wb, path);

  const buffer = fs.readFileSync(path);

  const newOssKey = `emptyPackages-${timestamp}.xlsx`;
  await ossClient.put(newOssKey, buffer);

  fs.unlinkSync(path);

  const signedURL = await generateSignedUrl(newOssKey);

  res.json({
    success: true,
    data: { signedURL, file: newOssKey },
  });
});

export const setEmptyPackagesBulk = handleAsync(async (req: Request, res: Response) => {
  const { ids, isProcessed } = req.body;

  // 构建更新条件
  const filter = { _id: { $in: ids } };

  // 构建更新内容
  const update: any = {};
  if (isProcessed !== undefined) {
    update.isProcessed = isProcessed;
  }

  // 执行更新操作
  const result = await EmptyPackage.updateMany(filter, update);

  res.json({
    success: true,
    data: result,
  });
});