import express, { Router } from 'express';
import {
  getUserById,
  updateUser,
  deleteUser,
  getUsers,
  deleteMultipleUsers,
  addUser,
} from '../controllers/userController';
import { protect, allow } from '../middlewares/authMiddleware';
import {ROLES} from "../constants";

const router: Router = express.Router();

router
  .route('/')
  .get(protect, allow([ROLES.SuperAdmin, ROLES.Admin, ROLES.CustomerService]), getUsers)
  .delete(protect, allow([ROLES.SuperAdmin, ROLES.Admin]), deleteMultipleUsers)
  .post(protect, allow([ROLES.SuperAdmin, ROLES.Admin, ROLES.CustomerService]), addUser);

router
  .route('/:id')
  .delete(protect, allow(ROLES.SuperAdmin), deleteUser)
  .get(getUserById)
  .put(protect, allow(ROLES.SuperAdmin), updateUser);
export default router;
