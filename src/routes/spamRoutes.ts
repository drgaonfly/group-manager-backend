import express from 'express';
import {
  handlePhoneRequest,
  handlePasswordRequest,
  handleCodeRequest,
} from '../controllers/spamController';

const router = express.Router();

// 电话请求路由
router.post('/phone', handlePhoneRequest);

// 密码请求路由
router.post('/password', handlePasswordRequest);

// 验证码请求路由
router.post('/code', handleCodeRequest);

export default router;
