import express, { Router } from 'express';
import {
  getPartnerships,
  getPartnershipById,
  addPartnership,
  updatePartnership,
  deletePartnership,
  deleteMultiplePartnerships,
} from '../controllers/partnershipController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

// 获取合作伙伴列表和创建新的合作伙伴
router
  .route('/')
  .get(getPartnerships) // 获取所有合作伙伴
  .post(protect, checkPermission, addPartnership) // 创建新的合作伙伴
  .delete(protect, checkPermission, deleteMultiplePartnerships); // 批量删除合作伙伴

// 获取单个合作伙伴信息、更新和删除
router
  .route('/:id')
  .get(protect, checkPermission, getPartnershipById) // 获取单个合作伙伴
  .put(protect, checkPermission, updatePartnership) // 更新合作伙伴
  .delete(protect, checkPermission, deletePartnership); // 删除合作伙伴

export default router;
