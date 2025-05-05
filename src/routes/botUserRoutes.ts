import express, { Router } from 'express';
import {
  getbotUsers,
  getbotUserById,
  addbotUser,
  updatebotUser,
  deletebotUser,
  deleteMultiplebotUsers,
  sendMessage,
} from '../controllers/botUserController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

// 批量路由处理

router
  .route('/')
  .get(protect, checkPermission, getbotUsers) // 获取机器人列表
  .post(protect, checkPermission, addbotUser) // 添加新机器人
  .delete(protect, checkPermission, deleteMultiplebotUsers); // 批量删除机器人

// 单个机器人路由处理
router
  .route('/:id')
  .get(protect, checkPermission, getbotUserById) // 获取单个机器人
  .put(protect, checkPermission, updatebotUser) // 更新机器人
  .delete(protect, checkPermission, deletebotUser); // 删除机器人

router.route('/:id/send-message').post(protect, checkPermission, sendMessage);

export default router;
