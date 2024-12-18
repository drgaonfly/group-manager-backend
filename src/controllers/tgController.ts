import { Request, Response } from 'express';
import { TelegramAuthService } from '../services/telegramAuth';
import handleAsync from '../utils/handleAsync';

const authService = new TelegramAuthService();

/**
 * 输入手机号并请求验证码
 */
export const enterPhone = handleAsync(async (req: Request, res: Response) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    res.status(400).json({
      success: false,
      message: '请提供手机号码',
    });
    return;
  }

  console.log(`Received phone number: ${phoneNumber}`);
  const sessionId = await authService.enterPhoneNumber(phoneNumber);

  console.log(`Generated session ID: ${sessionId}`);
  res.json({ success: true, sessionId });
});

/**
 * 输入验证码并完成登录
 */
export const enterCode = handleAsync(async (req: Request, res: Response) => {
  const { sessionId, code } = req.body;

  if (!sessionId || !code) {
    throw new Error('请提供会话ID和验证码');
  }

  const cookies = await authService.enterCode(sessionId, code);

  res.json({
    success: true,
    cookies,
  });
});
