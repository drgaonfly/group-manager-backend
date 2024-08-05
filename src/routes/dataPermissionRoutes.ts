import express, { Router } from 'express';
import {
  getDataPermissions,
  getDataPermissionById,
  addDataPermission,
  updateDataPermission,
  deleteDataPermission,
  deleteMultipleDataPermissions,
} from '../controllers/dataPermissionController';
import { protect } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, getDataPermissions)
  .post(protect, addDataPermission)
  .delete(protect, deleteMultipleDataPermissions);

router
  .route('/:id')
  .get(protect, getDataPermissionById)
  .put(protect, updateDataPermission)
  .delete(protect, deleteDataPermission);

export default router;
