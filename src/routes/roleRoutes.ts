import express, { Router } from 'express';
import {
  getRoles,
  getRoleById,
  addRole,
  updateRole,
  deleteRole,
  deleteMultipleRoles,
  getFilteredRoles,
} from '../controllers/roleController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

// 获取所有角色、添加新角色和批量删除角色
router
  .route('/')
  .get(protect, checkPermission, getRoles, checkPermission)
  .post(protect, checkPermission, addRole)
  .delete(protect, checkPermission, deleteMultipleRoles);

router.route('/filter').get(protect, getFilteredRoles);

// 根据 ID 获取、更新和删除角色
router
  .route('/:id')
  .get(protect, checkPermission, getRoleById)
  .put(protect, checkPermission, updateRole)
  .delete(protect, checkPermission, deleteRole);

export default router;
