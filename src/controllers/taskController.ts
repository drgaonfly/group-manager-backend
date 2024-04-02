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
  // 从请求的查询参数中获取country和platform
  const { country, platform } = req.query;

  // 构建一个查询对象，仅当提供了相应的查询参数时才添加对应的过滤条件
  const queryConditions: any = {};
  if (country) {
    queryConditions.country = country;
  }
  if (platform) {
    queryConditions.platform = platform;
  }

  // 使用过滤条件执行查询，并填充user字段以获取用户详情
  const tasks = await Task.find(queryConditions).populate('user');

  // 使用定义的函数来处理 file 字段
  const modifiedFileTasks = await transformDocumentImages(tasks, ['file', 'uploadedFile']);
  
  // 返回查询结果
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
