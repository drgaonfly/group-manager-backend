import { MyContext } from '../../../types';
import Success from '../../../../models/success';
import { randomBytes } from 'crypto';
import createDebug from 'debug';

const debug = createDebug('bot:start:mySuccess');

/** 生成8位大写字母+数字继承码 */
function generateCode(): string {
  return randomBytes(4).toString('hex').toUpperCase();
}

/**
 * 获取或创建当前用户的继承码，并展示给用户
 * 供 /start mycode 深链接调用
 */
export async function handleMySuccess(ctx: MyContext) {
  const bot = ctx.currentBot;
  const botUser = ctx.currentBotUser;

  if (!bot || !botUser) {
    await ctx.reply('❌ 初始化失败，请重试');
    return;
  }

  let record = await Success.findOne({ bot: bot._id, botUser: botUser._id });

  if (!record) {
    const code = generateCode();
    record = await Success.create({
      bot: bot._id,
      botUser: botUser._id,
      proxy: ctx.currentProxyUser._id,
      code,
    });
  }

  const balance = ctx.currentBotUserConfig?.usdt_balance ?? 0;

  await ctx.reply(
    `🔑 *您的继承码*\n\n` +
      `\`${record.code}\`\n\n` +
      `💰 当前积分余额：*${balance} USDT*\n\n` +
      `将此继承码提供给新账号，新账号使用「立即继承」功能输入此码后，您的积分将转移至新账号。\n\n` +
      `⚠️ 继承码仅可使用一次，继承后积分将清零。`,
    { parse_mode: 'Markdown' },
  );

  debug(`展示继承码：${record.code}，余额：${balance}`);
}
