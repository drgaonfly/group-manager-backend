import express, { Router } from 'express';
import {
  createAfterSalesOrder,
  getAfterSalesOrders,
  updateAfterSalesOrder,
  deleteAfterSalesOrder
} from '../controllers/afterSalesOrderController';
import { protect, allow } from '../middlewares/authMiddleware';
import { ROLES } from "../constants";

const router: Router = express.Router();

router
  .route('/')
  .get(protect, getAfterSalesOrders)  // Get list of after sales orders
  .post(protect, allow(ROLES.Admin), createAfterSalesOrder);  // Add a new after sales order

router
  .route('/:id')
  .get(protect, allow([ROLES.Admin]), updateAfterSalesOrder)  // Get details of a specific after sales order
  .put(protect, allow(ROLES.Admin), updateAfterSalesOrder)  // Update an after sales order
  .delete(protect, allow(ROLES.Admin), deleteAfterSalesOrder);  // Delete a specific after sales order

export default router;