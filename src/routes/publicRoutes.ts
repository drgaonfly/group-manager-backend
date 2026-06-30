import express, { Router } from 'express';
import { getPublicBotGroupsForUser } from '../controllers/publicController';

const router: Router = express.Router();

// 无需鉴权，供 Telegram 用户访问公共 bot 页面使用
router.get('/bots/:botId/:username', getPublicBotGroupsForUser);

export default router;
