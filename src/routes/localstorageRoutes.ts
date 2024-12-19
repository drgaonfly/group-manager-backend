import express from 'express';
import { handleLocalStorageData } from '../controllers/localstorageController';

const router = express.Router();

// 定义 POST 路由来接收 localStorage 数据
router.post(
  '/localstorage',
  (req, res, next) => {
    console.log('Received request at /localstorage'); // 添加调试信息
    next(); // 继续处理请求
  },
  handleLocalStorageData,
);

export default router;
