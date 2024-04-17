import express from 'express';
import {
  createEmptyPackage,
  getAllEmptyPackages,
  getEmptyPackageById,
  updateEmptyPackage,
  deleteEmptyPackage,
  deleteMultipleEmptyPackages
} from '../controllers/emptyPackageController'; // Adjust the import path as necessary
import { protect, allow } from '../middlewares/authMiddleware';
import { ROLES } from '../constants';

const router = express.Router();

// Define the routes for the EmptyPackage operations
router.post('/', protect, allow([ROLES.Customer, ROLES.Admin]), createEmptyPackage);
router.get('/', protect, allow([ROLES.Customer, ROLES.Admin]), getAllEmptyPackages);
router.get('/:id', protect, allow([ROLES.Customer, ROLES.Admin]), getEmptyPackageById);
router.put('/:id', protect, allow([ROLES.Customer, ROLES.Admin]), updateEmptyPackage);
router.delete('/:id', protect, allow([ROLES.Admin]), deleteEmptyPackage);
router.delete('/', protect, allow([ROLES.Admin]), deleteMultipleEmptyPackages);

export default router;