import express, { Router } from 'express';
import {
  getGroups,
  getGroupById,
  addGroup,
  updateGroup,
  deleteGroup,
  deleteMultipleGroups,
  verifyRequiredChannel,
} from '../controllers/groupController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, checkPermission, getGroups)
  .post(protect, checkPermission, addGroup)
  .delete(protect, checkPermission, deleteMultipleGroups);

router
  .route('/:id')
  .get(protect, checkPermission, getGroupById)
  .put(protect, checkPermission, updateGroup)
  .delete(protect, checkPermission, deleteGroup);

// 验证必须加入的频道
router.post('/verify-required-channel', verifyRequiredChannel);

export default router;
