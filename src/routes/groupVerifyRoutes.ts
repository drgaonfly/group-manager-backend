import express, { Router } from 'express';
import {
  getGroupVerifies,
  createGroupVerify,
  updateGroupVerify,
  deleteGroupVerify,
} from '../controllers/groupVerifyController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, checkPermission, getGroupVerifies)
  .post(protect, checkPermission, createGroupVerify);

router
  .route('/:id')
  .put(protect, checkPermission, updateGroupVerify)
  .delete(protect, checkPermission, deleteGroupVerify);

export default router;
