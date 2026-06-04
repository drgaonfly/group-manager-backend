import express, { Router } from 'express';
import {
  getBotUserConfigs,
  getBotUserConfigById,
  addBotUserConfig,
  updateBotUserConfig,
  deleteBotUserConfig,
  deleteMultipleBotUserConfigs,
  sendMessage,
  updateLocationPublic,
} from '../controllers/botUserConfigController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

// 公开路由（Mini App 调用，无需登录）
router.post('/public/location', updateLocationPublic);

// 批量路由处理

router
  .route('/')
  .get(protect, checkPermission, getBotUserConfigs) // 获取机器人列表
  .post(protect, checkPermission, addBotUserConfig) // 添加新机器人
  .delete(protect, checkPermission, deleteMultipleBotUserConfigs); // 批量删除机器人

router
  .route('/:id')
  .get(protect, checkPermission, getBotUserConfigById) // 获取单个机器人
  .put(protect, checkPermission, updateBotUserConfig) // 更新机器人
  .delete(protect, checkPermission, deleteBotUserConfig); // 删除机器人

router.route('/:id/send-message').post(protect, checkPermission, sendMessage);

export default router;
