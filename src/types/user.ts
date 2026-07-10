import { Request } from 'express';
import { IUser } from '../models/user';
import { ICustomer } from '../models/customer';

export interface RequestCustom extends Request {
  customer: ICustomer;
  getAllData?: boolean;
  user?: IUser;
  proxyUser?: IUser; // 真正的数据归属用户（用于创建数据的 proxy 字段）
}

export interface RequestAuth extends Request {
  auth?: any;
  customer?: ICustomer;
}
