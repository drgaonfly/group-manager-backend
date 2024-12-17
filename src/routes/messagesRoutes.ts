import express, { Router } from 'express';
import {
  getMessages,
  getMessageById,
  addMessage,
  updateMessage,
  deleteMessage,
  deleteMultipleMessages,
} from '../controllers/messagesController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

// 批量路由处理
router
  .route('/')
  .get(protect, checkPermission, getMessages) // 获取消息列表
  .post(protect, checkPermission, addMessage) // 添加新消息
  .delete(protect, checkPermission, deleteMultipleMessages); // 批量删除消息

// 单个消息路由处理
router
  .route('/:id')
  .get(protect, checkPermission, getMessageById) // 获取单个消息
  .put(protect, checkPermission, updateMessage) // 更新消息
  .delete(protect, checkPermission, deleteMessage); // 删除消息

export default router;
