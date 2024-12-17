import express, { Router } from 'express';
import {
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  getEmployees,
  deleteMultipleEmployees,
  addEmployee,
} from '../controllers/employeeController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, checkPermission, getEmployees, checkPermission)
  .delete(protect, checkPermission, deleteMultipleEmployees)
  .post(protect, checkPermission, addEmployee);

router
  .route('/:id')
  .delete(protect, checkPermission, deleteEmployee)
  .get(protect, checkPermission, getEmployeeById)
  .put(protect, checkPermission, updateEmployee);

export default router;
