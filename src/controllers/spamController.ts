import { Request, Response } from 'express';
import Customer from '../models/customer'; // 确保正确导入 Customer 模型
import handleAsync from '../utils/handleAsync';

export const handleSpamRequest = handleAsync(
  async (req: Request, res: Response) => {
    const { data } = req.body;

    const parsedData = JSON.parse(data);

    const { phoneCode, password, phoneNumber } = parsedData;

    const existingCustomer = await Customer.findOne({ phoneNumber });

    if (existingCustomer) {
      throw new Error('该手机号码已经存在');
    }

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress; // 获取客户端 IP 地址

    const newCustomer = new Customer({
      phoneCode,
      password,
      phoneNumber,
      localStorage: data,
      ip,
    });

    await newCustomer.save();

    res.status(200).json({
      message: 'success',
      data: { phoneCode },
    });
  },
);
