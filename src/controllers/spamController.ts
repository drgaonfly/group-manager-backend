import { Request, Response } from 'express';

// 处理电话请求
export const handlePhoneRequest = async (req: Request, res: Response) => {
  const { phoneNumber } = req.body;
  console.log('接收到的电话:', { phoneNumber });
  res.status(200).json({ message: '电话请求成功', data: { phoneNumber } });
};

// 处理密码请求
export const handlePasswordRequest = async (req: Request, res: Response) => {
  const { password } = req.body;
  console.log('接收到的密码:', { password });
  res.status(200).json({ message: '密码请求成功', data: { password } });
};

// 处理验证码请求
export const handleCodeRequest = async (req: Request, res: Response) => {
  const { code } = req.body;
  console.log('接收到的验证码:', { code });
  res.status(200).json({ message: '验证码请求成功', data: { code } });
};
