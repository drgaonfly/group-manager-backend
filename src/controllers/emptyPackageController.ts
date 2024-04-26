// src/controllers/emptyPackageController.ts
import { Request, Response } from 'express';
import handleAsync from '../utils/handleAsync';
import EmptyPackage from '../models/emptyPackage';  // Updated import to use EmptyPackage model
import { RequestCustom } from 'user';
import { transformDocumentImages } from '../utils/transformUtils';

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
    res.status(404).send({ success: false, message: 'Empty package not found' });
    return;
  }

  res.status(200).json({ success: true, data: emptyPackage });
});

export const updateEmptyPackage = handleAsync(async (req: Request, res: Response) => {
  const emptyPackage = await EmptyPackage.findByIdAndUpdate(req.params.id, req.body, { new: true });

  if (!emptyPackage) {
    res.status(404).send({ success: false, message: 'Empty package not found' });
    return;
  }

  res.status(200).json({ success: true, data: emptyPackage });
});

export const deleteEmptyPackage = handleAsync(async (req: Request, res: Response) => {
  const emptyPackage = await EmptyPackage.findByIdAndDelete(req.params.id);

  if (!emptyPackage) {
    res.status(404).send({ success: false, message: 'Empty package not found' });
    return;
  }

  res.status(200).json({ success: true, message: 'Empty package deleted successfully' });
});

export const deleteMultipleEmptyPackages = handleAsync(async (req: Request, res: Response) => {
  const { ids } = req.body; // Array of empty package IDs to delete

  if (!ids || !ids.length) {
    res.status(400).send({ success: false, message: 'No empty package IDs provided to delete' });
    return;
  }

  const result = await EmptyPackage.deleteMany({ _id: { $in: ids } });

  if (result.deletedCount === 0) {
    res.status(404).send({ success: false, message: 'No empty packages found to delete' });
    return;
  }

  res.json({ success: true, message: `${result.deletedCount} empty packages deleted successfully` });
});
