import express, { Router } from 'express';
import {
  getPermissionGroups,
  getPermissionGroupById,
  addPermissionGroup,
  updatePermissionGroup,
  deletePermissionGroup,
  deleteMultiplePermissionGroups,
} from '../controllers/permissionGroupController';
import { protect } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, getPermissionGroups)
  .post(protect, addPermissionGroup)
  .delete(protect, deleteMultiplePermissionGroups);

router
  .route('/:id')
  .get(protect, getPermissionGroupById)
  .put(protect, updatePermissionGroup)
  .delete(protect, deletePermissionGroup);

export default router;
