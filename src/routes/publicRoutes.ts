import express, { Router } from 'express';
import { getPublicBotGroupsForUser, getPublicBotGroupsForUserId } from '../controllers/publicController';

const router: Router = express.Router();

// 无需鉴权，供 Telegram 用户访问公共 bot 页面使用
router.get('/bots/:botId/user/:username', getPublicBotGroupsForUser);
router.get('/bots/:botId/userid/:tgUserId', getPublicBotGroupsForUserId);

export default router;
