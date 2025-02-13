import express, { Router } from 'express';
import {
  getMembers,
  deleteMultipleMembers,
  addMember,
  getMemberById,
  updateMember,
  deleteMember,
} from '../controllers/memberController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  // .get(protect, checkPermission, checkDataPermission, getUsers)
  .get(protect, checkPermission, getMembers)
  .delete(protect, checkPermission, deleteMultipleMembers)
  .post(protect, checkPermission, addMember);

router
  .route('/:id')
  .delete(protect, checkPermission, deleteMember)
  .get(protect, getMemberById)
  .put(protect, checkPermission, updateMember);

export default router;
