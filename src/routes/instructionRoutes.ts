import express, { Router } from 'express';
import {
  getInstructions,
  addInstruction,
  getInstructionById,
  updateInstruction,
  deleteInstruction,
  deleteMultipleInstructions,
} from '../controllers/instructionController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
  .route('/')
  .get(protect, checkPermission, getInstructions)
  .post(protect, checkPermission, addInstruction)
  .delete(protect, checkPermission, deleteMultipleInstructions);

router
  .route('/:id')
  .get(protect, checkPermission, getInstructionById)
  .put(protect, checkPermission, updateInstruction)
  .delete(protect, checkPermission, deleteInstruction);

export default router;
