import express, { Router } from 'express';
import {
  getChannelPosts,
  getChannelPostById,
  addChannelPost,
  updateChannelPost,
  deleteChannelPost,
  deleteMultipleChannelPosts,
  getUserChannels,
} from '../controllers/channelPostController';
import { protect, checkPermission } from '../middlewares/authMiddleware';
const router: Router = express.Router();

// 获取用户的频道列表
router.route('/channels').get(protect, getUserChannels);

// 管理员路由 - 需要认证和权限检查
router
  .route('/')
  .get(protect, checkPermission, getChannelPosts)
  .post(protect, checkPermission, addChannelPost)
  .delete(protect, checkPermission, deleteMultipleChannelPosts);

router
  .route('/:id')
  .get(protect, checkPermission, getChannelPostById)
  .put(protect, checkPermission, updateChannelPost)
  .delete(protect, checkPermission, deleteChannelPost);

export default router;
