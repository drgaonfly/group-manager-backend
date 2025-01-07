import express, { Router } from 'express';
import {
  deleteMultipleUsers,
  updateUser,
  deleteUser,
  getUsers,
  addUser,
  getUserById,
} from '../controllers/userController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, checkPermission, getUsers)
  .delete(protect, checkPermission, deleteMultipleUsers)
  .post(protect, checkPermission, addUser);

router
  .route('/:id')
  .delete(protect, checkPermission, deleteUser)
  .get(protect, getUserById)
  .put(protect, checkPermission, updateUser);

export default router;
