import { Router } from 'express';
import {
  getGroupWelcomes,
  getGroupWelcomeById,
  createGroupWelcome,
  updateGroupWelcome,
  deleteGroupWelcome,
} from '../controllers/groupWelcomeController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router = Router();

router
  .route('/')
  .get(protect, checkPermission, getGroupWelcomes)
  .post(protect, checkPermission, createGroupWelcome);

router
  .route('/:id')
  .get(protect, checkPermission, getGroupWelcomeById)
  .put(protect, checkPermission, updateGroupWelcome)
  .delete(protect, checkPermission, deleteGroupWelcome);

export default router;
