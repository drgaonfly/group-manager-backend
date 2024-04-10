// src/controllers/taskController.ts
import { Request, Response } from 'express';
import handleAsync from '../utils/handleAsync'; // Adjust the import path as necessary
import Task from '../models/task';
import { RequestCustom } from 'user';
import { transformDocumentImages } from '../utils/transformUtils';
import { ROLES } from '../constants';
import { handleExcelTask, readExcelData } from '../utils/processExcelFile';
import { generateSignedUrlForOSS } from '../utils/generateSignedUrl';
import Bill from '../models/bill';
// import { processExcelFile } from '../utils/processExcelFile';

export const createTask = handleAsync(async (req: RequestCustom, res: Response) => {
  const { file } = req.body; // 假设前端发送的是OSS中文件的key

  if (!file) {
    res.status(400).json({ success: false, message: '文件未提供' });
    return;
  }

  // 判断请求体中是否提供了user，如果提供了就使用该user，否则使用认证用户的_id
  const userId = req.body.user || req.user._id;

  // 创建新任务时，使用确定的userId
  const taskData = { ...req.body, user: userId };
  const task = new Task(taskData);

  // 保存任务到数据库
  const savedTask = await task.save();

  // 返回成功响应和保存的任务
  res.status(201).json({ success: true, data: savedTask });
});

export const getAllTasks = handleAsync(async (req: RequestCustom, res: Response) => {
  // Extracting pagination parameters or providing default values
  const { current = '1', pageSize = '10', country, platform, status, _id, orderTimeType, reviewType, orderType } = req.query;

  const queryConditions: any = {};
  if (country) {
    queryConditions.country = country;
  }
  if (platform) {
    queryConditions.platform = platform;
  }
  if (status) {
    queryConditions.status = status;
  }
  if (_id) {
    queryConditions._id = _id;
  }
  if (orderTimeType) {
    queryConditions.orderTimeType = orderTimeType;
  }
  if (reviewType) {
    queryConditions.reviewType = reviewType;
  }
  if (orderType) {
    queryConditions.orderType = { $in: orderType }; // Assuming orderType could be a CSV of order types
  }

  // Role-based query restriction for customer role
  if (req.user.role === ROLES.Customer) {
    queryConditions.user = req.user._id;
  }

  // Count total tasks matching the query conditions for pagination
  const total = await Task.countDocuments(queryConditions);

  // Fetching tasks with pagination applied
  const tasks = await Task.find(queryConditions)
    .populate('user')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize);

  // Optionally transform tasks data
  const modifiedFileTasks = await transformDocumentImages(tasks, ['file', 'uploadedFile']);

  // Returning the paginated tasks along with pagination details
  res.status(200).json({
    success: true,
    data: modifiedFileTasks,
    total,
    current: +current,
    pageSize: +pageSize
  });
});


export const getTaskById = handleAsync(async (req: Request, res: Response) => {
  const task = await Task.findById(req.params.id);
  if (!task) {
    res.status(404);
    throw new Error('Task not found');
  }
  res.status(200).json({ success: true, data: task });
});

export const updateTask = handleAsync(async (req: Request, res: Response) => {
  const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!task) {
    res.status(404);
    throw new Error('Task not found');
  }
  res.status(200).json({ success: true, data: task });
});

export const deleteTask = handleAsync(async (req: Request, res: Response) => {
  const task = await Task.findByIdAndDelete(req.params.id);
  if (!task) {
    res.status(404);
    throw new Error('Task not found');
  }
  res.status(200).json({ success: true, message: 'Task successfully deleted' });
});

export const deleteMultipleTasks = handleAsync(async (req: Request, res: Response) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || !ids.length) {
    res.status(400);
    throw new Error('Invalid request: No IDs provided');
  }

  const result = await Task.deleteMany({
    _id: { $in: ids },
  });

  if (result.deletedCount === 0) {
    res.status(404);
    throw new Error('No tasks found to delete');
  }

  res.json({
    success: true,
    message: `${result.deletedCount} tasks deleted successfully`,
    data: { deletedCount: result.deletedCount } // Optionally include more detailed data
  });
});

export const cancelTask = handleAsync(async (req: RequestCustom, res: Response) => {
  const { id } = req.params; // Assuming the task ID is passed as a URL parameter

  // First, find the task by its ID to check the creation time
  const task = await Task.findById(id);

  if (!task) {
    res.status(404).json({ success: false, message: '任务未找到' });
    return;
  }

  // Calculate the difference between now and the task's createdAt timestamp
  const timeElapsed = Date.now() - task.createdAt.getTime();

  // If more than 15 minutes have passed, do not allow cancellation
  if (timeElapsed > 15 * 60 * 1000) { // 15 minutes in milliseconds
    res.status(400).json({ success: false, message: '超过创建后15分钟，不能取消任务' });
    return;
  }

  // If within the time limit, update the task's status to 'Cancelled'
  const updatedTask = await Task.findByIdAndUpdate(id, { status: 'Cancelled' }, { new: true });

  // Though we've already checked for task existence, it's good practice to still check the update result
  if (!updatedTask) {
    res.status(404).json({ success: false, message: '更新任务状态时发生错误' });
    return;
  }

  // Return the updated task
  res.status(200).json({ success: true, data: updatedTask });
});


export const downloadUpdatedTaskFile = handleAsync(async (req: Request, res: Response) => {
  const taskId = req.body.taskId; // 使用POST方法，因此从req.body获取taskId
  const task = await Task.findById(taskId);
  
  if (!task || !task.file) {
    res.status(404).send('Task not found or file missing');
    return;
  }

  const newOssKey = await handleExcelTask(task.file);
  const signedURL = await generateSignedUrlForOSS(newOssKey);

  res.json({
    success: true,
    data: { signedURL, file: newOssKey },
  });
});

export const uploadBillFile = handleAsync(async (req: Request, res: Response) => {
  const taskId = req.body.taskId;
  const task = await Task.findById(taskId);

  if (!task) {
    res.status(404).send('Task not found');
    return;
  }

  if (task.billFile) {
    res.status(400).send('Bill file already uploaded for this task');
    return;
  }

  // Save the received billFile to the task
  task.billFile = req.body.billFile;
  await task.save();

  // Read data from the stored Excel file (assumes `task.billFile` is a path to the file)
  const bills = await readExcelData(task.billFile);

  // Save each bill to the database
  const savePromises = bills.map((billData) => new Bill({ ...billData, task: task._id }).save());
  await Promise.all(savePromises);

  res.json({
    success: true,
    message: 'Bills saved successfully',
    data: task
  });
});