import express, { Router } from 'express';
import {
  getBotUserConfigs,
  getBotUserConfigById,
  addBotUserConfig,
  updateBotUserConfig,
  deleteBotUserConfig,
  deleteMultipleBotUserConfigs,
  sendMessage,
  getBotUserConfigsByPromotionLink,
  getBotUserConfigsByBot,
} from '../controllers/botUserConfigController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

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

// 根据推广链接获取该链接下的用户配置列表
router
  .route('/by-promotion-link/:promotionLinkId')
  .get(protect, checkPermission, getBotUserConfigsByPromotionLink);

// 根据机器人获取该机器人下的用户配置列表
router
  .route('/by-bot/:botId')
  .get(protect, checkPermission, getBotUserConfigsByBot);

export default router;
