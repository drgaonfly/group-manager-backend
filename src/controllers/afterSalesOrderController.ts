// src/controllers/afterSalesOrderController.ts
import { Request, Response } from 'express';
import handleAsync from '../utils/handleAsync';
import AfterSalesOrder from '../models/afterSalesOrder';
import { RequestCustom } from 'user';
// import { transformDocumentImages } from '../utils/transformUtils';

// Create an after sales order
export const createAfterSalesOrder = handleAsync(async (req: RequestCustom, res: Response) => {
  const { reason, refundAmount, image, bill } = req.body;

  const newOrder = new AfterSalesOrder({
    reason,
    refundAmount,
    image,
    bill,
    user: req.body.user || req.user._id, //
  });

  const savedOrder = await newOrder.save();
  res.status(201).json({ success: true, data: savedOrder });
});

// Retrieve all after sales orders
export const getAfterSalesOrders = handleAsync(async (req: Request, res: Response) => {
  const {
    current = '1',
    pageSize = '10',
    bill, // Assuming bill ID can be a filter
    status,
  } = req.query as { current: string; status: string; pageSize: string; bill?: string };

  const queryConditions: any = {};
  if (bill) {
    queryConditions.bill = bill;  // Filtering by the bill ID linked to the after sales order
  }
  if (status) {
    queryConditions.status = status;
  }

  // More complex filters can be implemented here if needed.

  // Calculate the total number of after sales orders that match the query conditions
  const total = await AfterSalesOrder.countDocuments(queryConditions);

  // Retrieve after sales orders with pagination and populate related bill and user data
  const orders = await AfterSalesOrder.find(queryConditions)
    .populate('bill')
    .populate('user')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();
    
    // orders = await transformDocumentImages(orders, ['image']);

  // Send response with order data, total count, and pagination details
  res.json({
    success: true,
    data: orders,
    total,
    current: +current,
    pageSize: +pageSize
  });
});

// Update an after sales order
export const updateAfterSalesOrder = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;  // Using req.params to get the id from the route parameter
  const updatedOrder = await AfterSalesOrder.findByIdAndUpdate(id, req.body, { new: true })
    .populate('bill')
    .populate('user');

  if (!updatedOrder) {
    res.status(404);
    throw new Error('After Sales Order not found');
  }
  res.json({ success: true, data: updatedOrder });
});

// Delete an after sales order
export const deleteAfterSalesOrder = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const deletedOrder = await AfterSalesOrder.findByIdAndDelete(id);
  
  if (!deletedOrder) {
    res.status(404);
    throw new Error('After Sales Order not found');
  }
  res.status(200).json({ success: true, message: 'Order successfully deleted' });
});

// Note: Here's an example if you need to implement a 'delete multiple after sales orders' feature
export const deleteMultipleAfterSalesOrders = handleAsync(async (req: Request, res: Response) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400);
    throw new Error('Invalid request: No IDs provided');
  }

  const result = await AfterSalesOrder.deleteMany({ _id: { $in: ids } });

  res.json({
    success: true,
    message: `${result.deletedCount} after sales orders deleted successfully`,
    data: { deletedCount: result.deletedCount }
  });
});

export const reviewAfterSalesOrder = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;  // Using req.params to get the id from the route parameter
  const { status, rejectionReason } = req.body;  // Get status and rejectionReason from the request body

  // Check if status is either 'Approved' or 'Rejected'
  if (!['Approved', 'Rejected'].includes(status)) {
    res.status(400);
    throw new Error('Invalid status. Status should be either "Approved" or "Rejected".');
  }

  // If status is 'Rejected', rejectionReason must be provided
  if (status === 'Rejected' && !rejectionReason) {
    res.status(400);
    throw new Error('Rejection reason is required when status is "Rejected".');
  }

  const updatedOrder = await AfterSalesOrder.findByIdAndUpdate(id, { status, rejectionReason }, { new: true })
    .populate('bill')
    .populate('user');

  if (!updatedOrder) {
    res.status(404);
    throw new Error('After Sales Order not found');
  }
  res.json({ success: true, data: updatedOrder });
});


export default {
  createAfterSalesOrder,
  getAfterSalesOrders,
  updateAfterSalesOrder,
  deleteAfterSalesOrder,
  deleteMultipleAfterSalesOrders,
  reviewAfterSalesOrder
};
