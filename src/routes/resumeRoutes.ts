import express, { Router } from 'express';
import {
  getResumes,
  getResumeById,
  addResume,
  updateResume,
  deleteResume,
  deleteMultipleResumes,
} from '../controllers/resumeController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

// 批量路由处理
router
  .route('/')
  .get(protect, checkPermission, getResumes) // 获取简历列表
  .post(protect, checkPermission, addResume) // 添加新简历
  .delete(protect, checkPermission, deleteMultipleResumes); // 批量删除简历

// 单个简历路由处理
router
  .route('/:id')
  .get(protect, checkPermission, getResumeById) // 获取单个简历
  .put(protect, checkPermission, updateResume) // 更新简历
  .delete(protect, checkPermission, deleteResume); // 删除简历

export default router;
