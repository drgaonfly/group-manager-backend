import express, { Router } from 'express';
import {
  getPermissions,
  getPermissionById,
  addPermission,
  updatePermission,
  deletePermission,
  deleteMultiplePermissions,
} from '../controllers/permissionController';
import { protect } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, getPermissions)
  .post(protect, addPermission)
  .delete(protect, deleteMultiplePermissions);

router
  .route('/:id')
  .get(protect, getPermissionById)
  .put(protect, updatePermission)
  .delete(protect, deletePermission);

export default router;
