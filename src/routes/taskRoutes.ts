import express from 'express';
import { createTask, getAllTasks, getTaskById, updateTask, deleteTask, deleteMultipleTasks, cancelTask, downloadUpdatedTaskFile, uploadBillFile, claimTask } from '../controllers/taskController'; // Adjust the import path as necessary
import { allow, protect } from '../middlewares/authMiddleware';
import { ROLES } from '../constants';

const router = express.Router();

router.post('/', protect, allow([ROLES.Customer, ROLES.Admin]), createTask);
router.get('/', protect, allow([ROLES.Customer, ROLES.Admin, ROLES.CustomerService, ROLES.OrderPlacer, ROLES.Reviewer]), getAllTasks);
router.get('/:id', protect, allow([ROLES.Customer, ROLES.Admin]), getTaskById);
router.put('/:id', protect, allow([ROLES.Customer, ROLES.Admin, ROLES.CustomerService]), updateTask);
router.delete('/:id', protect, allow([ROLES.Admin]), deleteTask);
router.delete('/', protect, allow([ROLES.Admin]), deleteMultipleTasks);
router.patch('/download-task', protect, allow([ROLES.Admin, ROLES.CustomerService]), downloadUpdatedTaskFile);
router.patch('/:id/cancel', protect, allow([ROLES.Customer, ROLES.Admin, ROLES.CustomerService]), cancelTask);

router.post('/upload-bills', protect, allow([ROLES.Admin, ROLES.CustomerService]), uploadBillFile);
router.patch('/:id/claim', protect, allow([ROLES.Admin, ROLES.CustomerService]), claimTask);

export default router;