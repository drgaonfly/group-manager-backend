import express, { Router } from 'express';
import { getHome, getServe } from '../controllers/pageController';

const router: Router = express.Router();

// 获取所有页面
router.route('/').get(getHome);

// 服务页面
router.route('/serve').get(getServe);

export default router;
