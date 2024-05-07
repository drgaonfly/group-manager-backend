// src/controllers/billController.ts
import { Request, Response } from 'express';
import handleAsync from '../utils/handleAsync'; // Adjust the import path as necessary
import Bill, { IBill } from '../models/bill';
import * as XLSX from 'xlsx';
import { resolve } from 'path';
import ossClient from '../utils/oss';
import fs from "fs"
import { generateSignedUrl } from '../utils/generateSignedUrl';
import { countryMapping } from '../constants';
import { IUser } from '../models/user';
import AfterSalesOrder from '../models/afterSalesOrder';
import { RequestCustom } from 'user';
import Task, { ITask } from '../models/task';

export const createBill = handleAsync(async (req: Request, res: Response) => {
  const { storeName, orderNumber, amount, buyerId, task } = req.body;

  if (!task) {
    res.status(400)
    throw new Error('任务ID未提供');
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
    uploadTime,
    afterSales,
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
    // Find the task with the given code
    const taskDocument = await Task.findOne({ code: task });

    if (taskDocument) {
      // Use the id of the found task to filter bills
      queryConditions.task = taskDocument._id;
    }
  }
  if (country) {
    queryConditions.country = country; // Filtering by country within the task document
  }
  if (uploadTime) {
    queryConditions.uploadTime = uploadTime;
  }
  if (uploadTime) {
    queryConditions.uploadTime = uploadTime;
  }
  if (typeof afterSales === 'string' && afterSales !== '') {
    queryConditions.afterSales = afterSales === 'true';  // Convert 'true'/'false' string from query to boolean
  }

  // Calculate the total number of bills that match the query conditions
  const total = await Bill.countDocuments(queryConditions);

  // Retrieve bills with pagination and populate task details
  const bills = await Bill.find(queryConditions)
    .populate({
      path: 'task',
      populate: [
        { path: 'bills' },  // Populate the bills field in the task document
        { path: 'user' }   // Populate the user field in the task document
      ]
    })
    .populate("customer") // Populate the customer field if needed
    .sort('-createdAt')  // Sort by creation time in descending order
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  // Send response with bill data, total count, and pagination details
  const processedBills = await Promise.all(bills.map(async (bill) => {
    const task = bill.task as ITask;
    if (task && task.billFile) {
      task.billFile = await generateSignedUrl(task.billFile);
    }
    return bill;
  }));

  res.json({
    success: true,
    data: processedBills,
    total,
    current: +current,
    pageSize: +pageSize
  });
});


export const updateBill = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updatedBill = await Bill.findByIdAndUpdate(id, req.body, { new: true });
  if (!updatedBill) {
    res.status(404)
    throw new Error('Bill not found');
  }
  res.json({ success: true, data: updatedBill });
});

export const deleteBill = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const deletedBill = await Bill.findByIdAndDelete(id);
  if (!deletedBill) {
    res.status(404)
    throw new Error('Bill not found');
  }
  res.status(200).json({ success: true, message: 'Bill successfully deleted' });
});

export const deleteMultipleBills = handleAsync(async (req: Request, res: Response) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400)
    throw new Error('Invalid request: No IDs provided');
  }

  const result = await Bill.deleteMany({ _id: { $in: ids } });
  res.json({
    success: true,
    message: `${result.deletedCount} bills deleted successfully`,
    data: { deletedCount: result.deletedCount }
  });
});

export const exportBillsToExcel = handleAsync(async (req: Request, res: Response) => {
  const {
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

  // Retrieve all bills that match the query conditions
  const bills = await Bill.find(queryConditions)
    .populate("customer") // Populate the customer field if needed
    .exec();

  const countryMappingReverse = Object.fromEntries(Object.entries(countryMapping).map(([key, value]) => [value, key]));

  const billsPlainObjects = bills.map((bill: IBill) => ({
    '关联任务': bill.task.toString(),
    '客户': bill.customer && (bill.customer as IUser).email ? (bill.customer as IUser).email : '未知',
    '国家': countryMappingReverse[bill.country],
    '订单号': bill.orderNumber,
    '下单时间': bill.uploadTime,
    '店铺名': bill.storeName,
    '金额': bill.amount,
    '汇率': bill.exchangeRate,
    '服务费': bill.serviceFee,
    '支付金额': bill.paymentAmount,
    '买手号': bill.buyerId,
    '创建时间': bill.createdAt,
  }));

  const ws = XLSX.utils.json_to_sheet(billsPlainObjects);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Bills");

  const timestamp = Date.now();
  const path = resolve('/tmp', `bills-${timestamp}.xlsx`);
  XLSX.writeFile(wb, path);

  // Read the file into a buffer
  const buffer = fs.readFileSync(path);

  // Upload the file to OSS
  const newOssKey = `bills-${timestamp}.xlsx`;
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


export const createAfterSalesOrder = handleAsync(async (req: RequestCustom, res: Response) => {
  const { reason, refundAmount, image, id } = req.body;

  const billExists = await Bill.findById(id);

  if (!billExists) {
    res.status(400)
    throw new Error('Invalid bill ID.');
  }

  const afterSalesOrder = new AfterSalesOrder({
    reason,
    refundAmount,
    image,
    bill: id,
    orderNumber: billExists.orderNumber,
    user: req.body.user || req.user._id,
  });

  await afterSalesOrder.save();

  // Update the bill to set afterSales to true
  await Bill.findByIdAndUpdate(id, { afterSales: true });

  res.json({
    success: true,
    data: afterSalesOrder,
  });
});