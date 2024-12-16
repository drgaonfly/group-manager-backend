// 在 telegramRoutes.ts 中添加
import express from 'express';
import { login } from '../controllers/telegramController';

const router = express.Router();

router.post('/auth/two-factor-login', login); // 添加新的登录路由

export default router;
