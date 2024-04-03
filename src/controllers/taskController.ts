// src/controllers/taskController.ts
import { Request, Response } from 'express';
import handleAsync from '../utils/handleAsync'; // Adjust the import path as necessary
import Task from '../models/task';
import { RequestCustom } from 'user';
import { transformDocumentImages } from '../utils/transformUtils';
// import { processExcelFile } from '../utils/processExcelFile';

export const createTask = handleAsync(async (req: RequestCustom, res: Response) => {
  const { file } = req.body; // 假设前端发送的是OSS中文件的key

  if (!file) {
    res.status(400).json({ success: false, message: '文件未提供' });
    return;
  }

  // // 处理Excel文件：下载、修改、上传
  // const uploadedFile = await processExcelFile(file);

  // 创建新任务，包含处理后的文件路径
  const taskData = { ...req.body, user: req.user._id };
  const task = new Task(taskData);

  // 保存任务到数据库
  const savedTask = await task.save();

  // 返回成功响应和保存的任务
  res.status(201).json({ success: true, data: savedTask });
});


export const getAllTasks = handleAsync(async (req: Request, res: Response) => {
  // 从请求的查询参数中获取country, platform和status
  const { country, platform, status, _id, orderTimeType, reviewType } = req.query;

  // 构建一个查询对象，仅当提供了相应的查询参数时才添加对应的过滤条件
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

  // 使用过滤条件执行查询，并填充user字段以获取用户详情
  const tasks = await Task.find(queryConditions).populate('user');

  // 使用定义的函数来处理 file 字段
  const modifiedFileTasks = await transformDocumentImages(tasks, ['file', 'uploadedFile']);
  
  // 返回查询结果，指定要返回的字段
  res.status(200).json({ success: true, data: modifiedFileTasks });
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

