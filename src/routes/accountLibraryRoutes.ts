import express from 'express';
import {
  createAccount,
  getAllAccounts,
  getAccountById,
  updateAccount,
  deleteAccount,
  deleteMultipleAccounts
} from '../controllers/accountLibraryController'; // Adjust the import path as necessary
import { protect, allow } from '../middlewares/authMiddleware';
import { ROLES } from '../constants';

const router = express.Router();

// Define the routes for the Account Library operations
router.post('/', protect, allow([ROLES.Customer, ROLES.Admin]), createAccount);
router.get('/', protect, allow([ROLES.Customer, ROLES.Admin]), getAllAccounts);
router.get('/:id', protect, allow([ROLES.Customer, ROLES.Admin]), getAccountById);
router.put('/:id', protect, allow([ROLES.Customer, ROLES.Admin]), updateAccount);
router.delete('/:id', protect, allow([ROLES.Admin]), deleteAccount);
router.delete('/', protect, allow([ROLES.Admin]), deleteMultipleAccounts);

export default router;