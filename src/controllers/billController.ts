// src/controllers/billController.ts
import { Request, Response } from 'express';
import handleAsync from '../utils/handleAsync'; // Adjust the import path as necessary
import Bill, { IBill } from '../models/bill';
import * as XLSX from 'xlsx';
import { resolve } from 'path';
import ossClient from '../utils/oss';
import fs from "fs"
import { generateSignedUrl } from '../utils/generateSignedUrl';
import { ROLES, countryMapping } from '../constants';
import { IUser } from '../models/user';
import AfterSalesOrder from '../models/afterSalesOrder';
import { RequestCustom } from 'user';
import Task, { ITask } from '../models/task';
import moment from 'moment-timezone';

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

export const getBills = handleAsync(async (req: RequestCustom, res: Response) => {
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
    isSigned,
    isReviewed
  } = req.query;

  const queryConditions: any = {};
  // Adding filters for storeName, orderNumber, buyerId, and task
  if (storeName) {
    queryConditions.storeName = { $regex: storeName, $options: 'i' }; // Case-insensitive search
  }
  if (orderNumber) {
    const orderNumbers = (orderNumber as string).split(/[\s,]+/);  // Split the string by spaces and commas
    queryConditions.orderNumber = { $in: orderNumbers };  // Find any documents where orderNumber is in the array
  }
  if (buyerId) {
    queryConditions.buyerId = buyerId;
  }
  if (isSigned) {
    queryConditions.isSigned = isSigned;
  }
  if (isReviewed) {
    queryConditions.isReviewed = isReviewed;
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
  if (typeof afterSales === 'string' && afterSales !== '') {
    queryConditions.afterSales = afterSales === 'true';  // Convert 'true'/'false' string from query to boolean
  }

  if (req.user.role === ROLES.Customer) {
    queryConditions.customer = req.user._id; // 只查询当前用户的账单
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
    .populate("user", "-password")
    .populate("customer") // Populate the customer field if needed
    .populate({
      path: "operations.user",
      select: "-password"  // Exclude the password field
    })
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


export const updateBill = handleAsync(async (req: RequestCustom, res: Response) => {
  const { id } = req.params;
  const bill = await Bill.findById(id);
  if (!bill) {
    res.status(404)
    throw new Error('Bill not found');
  }

  // Update the bill with the request body
  Object.assign(bill, req.body);
  bill.user = req.user._id;

  // Add a new operation record
  bill.operations.push({
    user: req.user._id,
    operation: 'updateBill',
    operationTime: new Date()
  });

  // Save the bill
  const updatedBill = await bill.save();

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
    const parsedDateTime = moment((uploadTime as string).replace(/"/g, ''));
    // 将日期对象转换为北京时间并格式化为年月日格式
    const beijingDate = parsedDateTime.tz("Asia/Shanghai").format('YYYY-MM-DD');
    queryConditions.uploadTime = beijingDate;
  }

  // Retrieve all bills that match the query conditions
  const bills = await Bill.find(queryConditions)
    .populate("task")
    .populate("customer") // Populate the customer field if needed
    .exec();

  const countryMappingReverse = Object.fromEntries(Object.entries(countryMapping).map(([key, value]) => [value, key]));

  const billsPlainObjects = bills.map((bill: IBill) => ({
    '关联任务': (bill.task as ITask)?.code,
    '客户': bill.customer && (bill.customer as IUser).name ? (bill.customer as IUser).name : '未知',
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
    '是否售后': bill.afterSales ? '是' : '',
    '备注': bill.billNote
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


export const deleteBills = handleAsync(async (req: Request, res: Response) => {
  const {
    storeName,
    orderNumber,
    buyerId,
    task,
    country,
    uploadTime
  } = req.body;

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
    const parsedDateTime = moment((uploadTime as string).replace(/"/g, ''));
    // 将日期对象转换为北京时间并格式化为年月日格式
    const beijingDate = parsedDateTime.tz("Asia/Shanghai").format('YYYY-MM-DD');
    queryConditions.uploadTime = beijingDate;
  }

  // Delete the bills that match the query conditions
  const deleteResult = await Bill.deleteMany(queryConditions);

  res.json({
    success: true,
    data: { deletedCount: deleteResult.deletedCount },
  });
});

export const createAfterSalesOrder = handleAsync(async (req: RequestCustom, res: Response) => {
  const { reason, refundAmount, id, applicationTime } = req.body;

  if (applicationTime) {
    const dateMatch = applicationTime.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      req.body.applicationTime = dateMatch[0]; // 如果找到匹配项，则只保留年月日
    }
  }

  const billExists = await Bill.findById(id);

  if (!billExists) {
    res.status(400)
    throw new Error('Invalid bill ID.');
  }

  const afterSalesOrder = new AfterSalesOrder({
    reason,
    refundAmount,
    bill: id,
    applicationTime: req.body.applicationTime,
    orderNumber: billExists.orderNumber,
    user: req.body.user || req.user._id,
  });

  await afterSalesOrder.save();

  // Find the bill
  const bill = await Bill.findById(id);

  // Update the bill
  bill.afterSales = true;
  bill.user = req.user._id;

  // Add a new operation record
  bill.operations.push({
    user: req.user._id,
    operation: 'applyAfterSales',
    operationTime: new Date()
  });

  // Save the bill
  await bill.save();

  res.json({
    success: true,
    data: afterSalesOrder,
  });
});

export const updateBillsBulk = handleAsync(async (req: Request, res: Response) => {
  const { ids, isSigned, isReviewed } = req.body;

  // 构建更新条件
  const filter = { _id: { $in: ids } };

  // 构建更新内容
  const update: any = {};
  if (isSigned !== undefined) {
    update.isSigned = isSigned;
  }
  if (isReviewed !== undefined) {
    update.isReviewed = isReviewed;
  }

  // 执行更新操作
  const result = await Bill.updateMany(filter, update);

  res.json({
    success: true,
    data: result,
  });
});
