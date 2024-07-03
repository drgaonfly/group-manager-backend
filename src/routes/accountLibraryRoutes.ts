import express from 'express';
import {
  createAccount,
  getAllAccounts,
  getAccountById,
  updateAccount,
  deleteAccount,
  deleteMultipleAccounts,
  uploadAccountLibrary,
  exportAccountsToExcel
} from '../controllers/accountLibraryController'; // Adjust the import path as necessary
import { protect, allow } from '../middlewares/authMiddleware';
import { ROLES } from '../constants';

const router = express.Router();

// Define the routes for the Account Library operations
router.post('/', protect, allow([ROLES.Admin]), createAccount);
router.get('/', protect, allow([ROLES.Admin, ROLES.CustomerService]), getAllAccounts);
router.get('/export', protect, allow([ROLES.Admin, ROLES.CustomerService]), exportAccountsToExcel);
router.get('/:id', protect, allow([ROLES.Admin]), getAccountById);
router.put('/:id', protect, allow([ROLES.Admin, ROLES.CustomerService]), updateAccount);
router.delete('/:id', protect, allow([ROLES.Admin]), deleteAccount);
router.delete('/', protect, allow([ROLES.Admin]), deleteMultipleAccounts);

router.post('/upload', protect, allow([ROLES.CustomerService, ROLES.Admin]), uploadAccountLibrary);

export default router;