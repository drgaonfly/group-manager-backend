import { Request, Response } from 'express';

export const handleSpamRequest = async (req: Request, res: Response) => {
  const { data } = req.body;

  // 解析接收到的序列化数据
  const parsedData = JSON.parse(data);
  console.log('接收到的 localStorage 数据:', parsedData);

  // 返回成功响应
  res.status(200).json({ message: '请求成功', data: parsedData });
};
