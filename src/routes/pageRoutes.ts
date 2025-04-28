import express, { Router } from 'express';
import { getHome, getServe, getInvite } from '../controllers/pageController';

const router: Router = express.Router();

// 获取所有页面
router.route('/home').get(getHome);

// 服务页面
router.route('/serve').get(getServe);

// 邀请页面
router.route('/invite').get(getInvite);

export default router;
