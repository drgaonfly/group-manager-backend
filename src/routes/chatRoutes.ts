import express, { Router } from 'express';
import {
  getChatById,
  updateChat,
  deleteChat,
  getChats,
  deleteMultipleChats,
  addChat,
  getChatMessages,
  addChatMessage,
  addChatUserMessage,
  getChatUserMessagesByCustomer,
} from '../controllers/chatController';
import {
  protect,
  checkPermission,
  customerProtect,
} from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, checkPermission, getChats)
  .delete(protect, checkPermission, deleteMultipleChats)
  .post(protect, checkPermission, addChat);

router
  .route('/messages')
  .get(customerProtect, getChatMessages)
  .post(customerProtect, addChatMessage);

// 后台用户与客户的群聊对话信息
router
  .route('/user-messages')
  .get(protect, checkPermission, getChatUserMessagesByCustomer)
  .post(protect, checkPermission, addChatUserMessage);

router
  .route('/:id')
  .delete(protect, checkPermission, deleteChat)
  .get(protect, checkPermission, getChatById)
  .put(protect, checkPermission, updateChat);

export default router;
