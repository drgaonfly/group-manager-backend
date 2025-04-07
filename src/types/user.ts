import { Request } from 'express';
import { IUser } from '../models/user';
import { ICustomer } from '../models/customer';

export interface RequestCustom extends Request {
  customer: ICustomer;
  getAllData?: boolean;
  user?: IUser;
}

export interface RequestAuth extends Request {
  auth?: any;
  customer?: ICustomer;
}
