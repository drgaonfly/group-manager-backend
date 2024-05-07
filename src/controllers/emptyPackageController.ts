// src/controllers/emptyPackageController.ts
import { Request, Response } from 'express';
import handleAsync from '../utils/handleAsync';
import EmptyPackage from '../models/emptyPackage';  // Updated import to use EmptyPackage model
import { RequestCustom } from 'user';
import { transformDocumentImages } from '../utils/transformUtils';
import XLSX from 'xlsx';
import fs from 'fs';
import { resolve } from 'path';
import { IUser } from '../models/user'; // Assuming you have this interface
import { IEmptyPackage } from '../models/emptyPackage'; // Assuming you have this interface
import { generateSignedUrlForOSS } from '../utils/generateSignedUrl';
import { countryMapping } from '../constants';
import ossClient from '../utils/oss';

export const createEmptyPackage = handleAsync(async (req: RequestCustom, res: Response) => {
  const emptyPackageData = new EmptyPackage({
    ...req.body,
    user: req.body.user || req.user._id,  // Assuming 'user' is authenticated and attached to req
  });

  const savedEmptyPackage = await emptyPackageData.save();
  res.status(201).json({ success: true, data: savedEmptyPackage });
});

export const getAllEmptyPackages = handleAsync(async (req: Request, res: Response) => {
  // Extracting pagination and filter parameters or providing default values
  const { current = '1', pageSize = '10', isProcessed, country, _id, platform } = req.query;

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

  // Convert current and pageSize to numbers to use in skip and limit
  const currentNum = parseInt(current as string, 10);
  const pageSizeNum = parseInt(pageSize as string, 10);

  // Count total empty packages matching the query conditions for pagination
  const total = await EmptyPackage.countDocuments(queryConditions);

  // Fetching empty packages with pagination applied
  const emptyPackages = await EmptyPackage.find(queryConditions)
    .populate('user')
    .sort('-createdAt')  // Add this line to sort by creation time in descending order
    .skip((currentNum - 1) * pageSizeNum)
    .limit(pageSizeNum);

  const modifiedEmptyPackages = await transformDocumentImages(emptyPackages, ['pdfFile', 'zipFile']);

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
  // Remove pdfFile and zipFile from the update
  const update = { ...req.body };
  delete update.pdfFile;
  delete update.zipFile;

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

  const emptyPackagesPlainObjects = emptyPackages.map((emptyPackage: IEmptyPackage) => ({
    '编号': emptyPackage._id,
    '国家': countryMappingReverse[emptyPackage.country],
    '平台': emptyPackage.platform,
    'PDF 文件': emptyPackage.pdfFile,
    '压缩文件': emptyPackage.zipFile,
    '上传用户': (emptyPackage.user as IUser)?.name,
    '单量': emptyPackage.quantity,
    '是否处理': emptyPackage.isProcessed ? '是' : '否',
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

  const signedURL = await generateSignedUrlForOSS(newOssKey);

  res.json({
    success: true,
    data: { signedURL, file: newOssKey },
  });
});