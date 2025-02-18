import express, { Router } from 'express';
import {
  getRegulationAgencies,
  getRegulationAgencyById,
  addRegulationAgency,
  updateRegulationAgency,
  deleteRegulationAgency,
  deleteMultipleRegulationAgencies,
} from '../controllers/regulationAgencyController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

// 获取监管机构列表和创建新的监管机构
router
  .route('/')
  .get(protect, checkPermission, getRegulationAgencies) // 获取所有监管机构
  .post(protect, checkPermission, addRegulationAgency) // 创建新的监管机构
  .delete(protect, checkPermission, deleteMultipleRegulationAgencies); // 批量删除监管机构

// 获取单个监管机构信息、更新和删除
router
  .route('/:id')
  .get(protect, checkPermission, getRegulationAgencyById) // 获取单个监管机构
  .put(protect, checkPermission, updateRegulationAgency) // 更新监管机构
  .delete(protect, checkPermission, deleteRegulationAgency); // 删除监管机构

export default router;
