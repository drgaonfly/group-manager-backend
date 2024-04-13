// src/controllers/billController.ts
import { Request, Response } from 'express';
import handleAsync from '../utils/handleAsync'; // Adjust the import path as necessary
import Bill from '../models/bill';

export const createBill = handleAsync(async (req: Request, res: Response) => {
  const { storeName, orderNumber, amount, buyerId, task } = req.body;

  if (!task) {
    res.status(400).json({ success: false, message: '任务ID未提供' });
    return;
  }

  const newBill = new Bill({
    storeName,
    orderNumber,
    amount,
    buyerId,
    task
  });

  const savedBill = await newBill.save();
  res.status(201).json({ success: true, data: savedBill });
});

export const getBills = handleAsync(async (req: Request, res: Response) => {
  const {
    current = '1', 
    pageSize = '10', 
    storeName, 
    orderNumber, 
    buyerId, 
    task,
    country,
    uploadTime
  } = req.query;

  const queryConditions: any = {};
  // Adding filters for storeName, orderNumber, buyerId, and task
  if (storeName) {
    queryConditions.storeName = { $regex: storeName, $options: 'i' }; // Case-insensitive search
  }
  if (orderNumber) {
    queryConditions.orderNumber = orderNumber;
  }
  if (buyerId) {
    queryConditions.buyerId = buyerId;
  }
  if (task) {
    queryConditions.task = task; // Filtering by task ID
  }
  if (country) {
    queryConditions.country = country; // Filtering by country within the task document
  }
  if (uploadTime) {
    queryConditions.uploadTime = uploadTime;
  }

  // Calculate the total number of bills that match the query conditions
  const total = await Bill.countDocuments(queryConditions);

  // Retrieve bills with pagination and populate task details
  const bills = await Bill.find(queryConditions)
    .populate("task") // Ensure to populate necessary task fields
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  // Send response with bill data, total count, and pagination details
  res.json({
    success: true,
    data: bills,
    total,
    current: +current,
    pageSize: +pageSize
  });
});


export const updateBill = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updatedBill = await Bill.findByIdAndUpdate(id, req.body, { new: true });
  if (!updatedBill) {
    res.status(404).send({ message: 'Bill not found' });
    return;
  }
  res.json({ success: true, data: updatedBill });
});

export const deleteBill = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const deletedBill = await Bill.findByIdAndDelete(id);
  if (!deletedBill) {
    res.status(404).send({ message: 'Bill not found' });
    return;
  }
  res.status(200).json({ success: true, message: 'Bill successfully deleted' });
});

export const deleteMultipleBills = handleAsync(async (req: Request, res: Response) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).send({ message: 'Invalid request: No IDs provided' });
    return;
  }

  const result = await Bill.deleteMany({ _id: { $in: ids } });
  res.json({
    success: true,
    message: `${result.deletedCount} bills deleted successfully`,
    data: { deletedCount: result.deletedCount }
  });
});
