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

  // 使用类型断言并使用正确的属性名
  const sentCode = result as any;
  res.json({
    success: true,
    data: {
      phoneCodeHash: sentCode.phone_code_hash,
      timeout: sentCode.timeout || 120, // 提供默认超时时间
    },
  });
});

// 验证码登录
export const signIn = handleAsync(async (req: Request, res: Response) => {
  const { phoneNumber, phoneCode, phoneCodeHash } = req.body;

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
      user: signInResult,
    },
  });
});
