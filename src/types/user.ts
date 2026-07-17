import { Request } from 'express';
import { IUser } from '../models/user';
import { ICustomer } from '../models/customer';

export interface RequestCustom extends Request {
  customer: ICustomer;
  getAllData?: boolean;
  user?: IUser;
  proxyUser?: IUser; // 真正的数据归属用户（用于创建数据的 proxy 字段）
  tenant?: string; // 租户上下文：非管理员用户的 botId（从 JWT 中提取）
}

export interface RequestAuth extends Request {
  auth?: any;
  customer?: ICustomer;
}
