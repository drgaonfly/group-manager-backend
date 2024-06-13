import express from 'express';
import {
  createEmptyPackage,
  getAllEmptyPackages,
  getEmptyPackageById,
  updateEmptyPackage,
  deleteEmptyPackage,
  deleteMultipleEmptyPackages,
  exportEmptyPackagesToExcel, // Make sure to import this function
  setEmptyPackagesBulk
} from '../controllers/emptyPackageController'; // Adjust the import path as necessary
import { protect, allow } from '../middlewares/authMiddleware';
import { ROLES } from '../constants';

const router = express.Router();

// Define the routes for the EmptyPackage operations
router.post('/', protect, allow([ROLES.Customer, ROLES.Admin]), createEmptyPackage);
router.get('/', protect, allow([ROLES.Customer, ROLES.Admin, ROLES.CustomerService]), getAllEmptyPackages);
router.get('/export', protect, allow([ROLES.Admin]), exportEmptyPackagesToExcel);
router.get('/:id', protect, allow([ROLES.Customer, ROLES.Admin]), getEmptyPackageById);
router.route('/bulk-setting')
  .put(protect, allow([ROLES.Admin]), setEmptyPackagesBulk);
router.put('/:id', protect, allow([ROLES.Customer, ROLES.Admin]), updateEmptyPackage);
router.delete('/:id', protect, allow([ROLES.Admin]), deleteEmptyPackage);
router.delete('/', protect, allow([ROLES.Admin]), deleteMultipleEmptyPackages);

// Add a new route for exporting empty packages to Excel

export default router;