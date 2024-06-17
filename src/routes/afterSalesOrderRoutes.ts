import express, { Router } from 'express';
import {
  createAfterSalesOrder,
  getAfterSalesOrders,
  updateAfterSalesOrder,
  deleteAfterSalesOrder,
  reviewAfterSalesOrder,
  deleteMultipleAfterSalesOrders
} from '../controllers/afterSalesOrderController';
import { protect, allow } from '../middlewares/authMiddleware';
import { ROLES } from "../constants";

const router: Router = express.Router();

router
  .route('/')
  .get(protect, allow([ROLES.Admin, ROLES.CustomerService, ROLES.OrderPlacer, ROLES.Reviewer]), getAfterSalesOrders)  // Get list of after sales orders
  .post(protect, allow(ROLES.Admin), createAfterSalesOrder)  // Add a new after sales order
  .delete(protect, allow([ROLES.Admin]), deleteMultipleAfterSalesOrders);

router
  .route('/:id')
  .get(protect, allow([ROLES.Admin, ROLES.CustomerService, ROLES.OrderPlacer, ROLES.Reviewer]), updateAfterSalesOrder)  // Get details of a specific after sales order
  .put(protect, allow([ROLES.Admin, ROLES.CustomerService, ROLES.OrderPlacer, ROLES.Reviewer]), updateAfterSalesOrder)  // Update an after sales order
  .delete(protect, allow(ROLES.Admin), deleteAfterSalesOrder);  // Delete a specific after sales order

router
  .route('/:id/review')
  .put(protect, allow([ROLES.Admin, ROLES.CustomerService]), reviewAfterSalesOrder);

export default router;