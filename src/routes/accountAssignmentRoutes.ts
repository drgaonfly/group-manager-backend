import express from 'express';
import {
  createAssignment,
  getAllAssignments,
  getAssignmentById,
  updateAssignment,
  deleteAssignment,
  deleteMultipleAssignments
} from '../controllers/accountAssignmentController'; // Adjust the import path as necessary
import { protect, allow } from '../middlewares/authMiddleware';
import { ROLES } from '../constants';

const router = express.Router();

// Define the routes for the Account Assignment operations
router.post('/', protect, allow([ROLES.Customer, ROLES.Admin]), createAssignment);
router.get('/', protect, allow([ROLES.Customer, ROLES.Admin]), getAllAssignments);
router.get('/:id', protect, allow([ROLES.Customer, ROLES.Admin]), getAssignmentById);
router.put('/:id', protect, allow([ROLES.Customer, ROLES.Admin]), updateAssignment);
router.delete('/:id', protect, allow([ROLES.Admin]), deleteAssignment);
router.delete('/', protect, allow([ROLES.Admin]), deleteMultipleAssignments);

export default router;