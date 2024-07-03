import express, { Router } from 'express';
import {
  createBill,
  getBills,
  updateBill,
  deleteBill,
  deleteMultipleBills,
  exportBillsToExcel,
  createAfterSalesOrder,
  updateBillsBulk,
  deleteBills
} from '../controllers/billController';
import { protect, allow } from '../middlewares/authMiddleware';
import { ROLES } from "../constants";

const router: Router = express.Router();

// Define routes for bill-related actions
router
  .route('/')
  .get(protect, allow([ROLES.Admin, ROLES.Customer, ROLES.CustomerService, ROLES.OrderPlacer, ROLES.Reviewer]), getBills)  // Get list of bills
  .delete(protect, allow(ROLES.Admin), deleteMultipleBills)    // Delete multiple bills
  .post(protect, allow(ROLES.Admin), createBill);                // Add a new bill

router.delete('/delete-records', protect, allow([ROLES.SuperAdmin]), deleteBills);

router
  .route('/export')
  .get(protect, allow(ROLES.Admin), exportBillsToExcel); 
router
  .route('/bulk-setting')
  .put(protect, allow(ROLES.Admin), updateBillsBulk);  
router
  .route('/:id')
  .delete(protect, allow(ROLES.Admin), deleteBill)            // Delete a specific bill
  .get(protect, allow([ROLES.Admin]), updateBill)             // Get details of a specific bill
  .put(protect, allow(ROLES.Admin), updateBill);              // Update a bill
  
router
  .route('/after-sales-order')
  .post(protect, allow(ROLES.Admin), createAfterSalesOrder);

export default router;