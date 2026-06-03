export const ITEMS_PER_PAGE = 5;

export const ROLES = {
  SuperAdmin: 'SUPER_ADMIN',
  Admin: 'ADMIN',
  Customer: 'CUSTOMER',
  OrderPlacer: 'ORDER_PLACER', // New role for placing orders
  Reviewer: 'REVIEWER', // New role for reviewing orders
  CustomerService: 'CUSTOMER_SERVICE', // New role for customer service
} as const;
