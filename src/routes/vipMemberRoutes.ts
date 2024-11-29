import express, { Router } from 'express';
import {
  getVipMembers,
  getVipMemberById,
  addVipMember,
  updateVipMember,
  deleteVipMember,
  deleteMultipleVipMembers,
} from '../controllers/vipMemberController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

// 批量路由处理
router
  .route('/')
  .get(protect, checkPermission, getVipMembers) // 获取 VIP 会员列表
  .post(protect, checkPermission, addVipMember) // 添加新 VIP 会员
  .delete(protect, checkPermission, deleteMultipleVipMembers); // 批量删除 VIP 会员

// 单个 VIP 会员路由处理
router
  .route('/:id')
  .get(protect, checkPermission, getVipMemberById) // 获取单个 VIP 会员
  .put(protect, checkPermission, updateVipMember) // 更新 VIP 会员
  .delete(protect, checkPermission, deleteVipMember); // 删除 VIP 会员

export default router;
