import { Request, Response } from 'express';
import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import handleAsync from '../utils/handleAsync';
import dotenv from 'dotenv';

dotenv.config();

const API_ID = process.env.TELEGRAM_API_ID || '94575';
const API_HASH =
  process.env.TELEGRAM_API_HASH || 'a3406de8d171bb422bb6ddf3bbd800e2';

// 发送验证码
export const sendAuthCode = handleAsync(async (req: Request, res: Response) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    res.status(400);
    throw new Error('Phone number is required');
  }

  const session = new StringSession('');
  const client = new TelegramClient(session, parseInt(API_ID), API_HASH, {});

  await client.connect();

  const result = await client.invoke(
    new Api.auth.SendCode({
      phoneNumber: phoneNumber,
      apiId: parseInt(API_ID),
      apiHash: API_HASH,
      settings: new Api.CodeSettings({
        allowFlashcall: true,
        currentNumber: true,
        allowAppHash: true,
        allowMissedCall: true,
        logoutTokens: [Buffer.from('arbitrary data here')],
      }),
    }),
  );

  await client.disconnect();

  res.json({
    success: true,
    data: result,
  });
});

// 验证码登录
export const signIn = handleAsync(async (req: Request, res: Response) => {
  const { phoneNumber, phoneCode, phoneCodeHash } = req.body;

  // 验证所有必需参数
  if (!phoneNumber || !phoneCode || !phoneCodeHash) {
    res.status(400);
    throw new Error(
      'Phone number, verification code, and code hash are required',
    );
  }

  const session = new StringSession('');
  const client = new TelegramClient(session, parseInt(API_ID), API_HASH, {});

  await client.connect();

  const signInResult = (await client.invoke(
    new Api.auth.SignIn({
      phoneNumber: phoneNumber,
      phoneCodeHash: phoneCodeHash,
      phoneCode: phoneCode,
    }),
  )) as Api.auth.TypeAuthorization;

  // 获取会话字符串以供将来使用
  const sessionString = client.session.save();

  await client.disconnect();

  res.json({
    success: true,
    data: {
      session: sessionString,
      result: signInResult,
    },
  });
});

export const login = handleAsync(async (req: Request, res: Response) => {
  const { phoneNumber, password, phoneCode } = req.body;

  // 验证必需参数
  if (!phoneNumber || !phoneCode) {
    res.status(400);
    throw new Error('Phone number and verification code are required');
  }

  const session = new StringSession('');
  const client = new TelegramClient(session, parseInt(API_ID), API_HASH, {
    connectionRetries: 5,
  });

  // 使用 start 方法进行登录
  await client.start({
    phoneNumber: async () => phoneNumber,
    password: async () => password,
    phoneCode: async () => phoneCode,
    onError: (err) => {
      throw new Error(err.message);
    },
  });

  // 获取会话字符串
  const sessionString = client.session.save();

  // 发送测试消息到自己
  await client.sendMessage('me', { message: 'Login successful!' });

  await client.disconnect();

  res.json({
    success: true,
    data: {
      session: sessionString,
      message: 'Login successful',
    },
  });
});
