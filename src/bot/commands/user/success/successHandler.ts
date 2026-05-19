import { MyContext } from '../../../types';
import Success from '../../../../models/success';
import BotUserConfig from '../../../../models/botUserConfig';
import { IBotUser } from '../../../../models/botUser';
import { IBot } from '../../../../models/bot';
import createDebug from 'debug';

const debug = createDebug('bot:success:handler');

/**
 * 处理用户输入的继承码，执行积分转移
 * 供 inheritConversation 对话调用
 */
export async function handleInheritCode(
  ctx: MyContext,
  bot: IBot,
  botUser: IBotUser,
  code: string,
) {
  if (!bot || !botUser) {
    await ctx.reply('❌ 初始化失败，请重试');
    return;
  }

  const normalizedCode = code.trim().toUpperCase();

  const record = await Success.findOne({
    bot: bot._id,
    code: normalizedCode,
    used: false,
  });

  if (!record) {
    await ctx.reply('❌ 继承码无效 或者 已经使用过了，请检查后重试');
    return;
  }

  // 不能继承自己的积分（populate 后 record.botUser 是对象，需取 _id 比较）
  const sourceBotUserId = record.botUser;
  if (sourceBotUserId.toString() === botUser._id.toString()) {
    await ctx.reply('❌ 不能继承自己的积分');
    return;
  }

  const sourceConfig = await BotUserConfig.findOne({
    bot: bot._id,
    botUser: sourceBotUserId,
  });

  if (!sourceConfig) {
    await ctx.reply('❌ 来源账号不存在');
    return;
  }

  const amount = sourceConfig.usdt_balance;

  if (amount <= 0) {
    await ctx.reply('❌ 来源账号积分余额为 0，无法继承');
    return;
  }

  // 来源清零，目标增加
  await BotUserConfig.findByIdAndUpdate(sourceConfig._id, {
    $set: { usdt_balance: 0 },
  });

  await BotUserConfig.findOneAndUpdate(
    { bot: bot._id, botUser: botUser._id },
    { $inc: { usdt_balance: amount } },
  );

  // 标记继承码已使用，保留记录（不删除）
  await Success.findByIdAndUpdate(record._id, {
    $set: {
      used: true,
      targetBotUser: botUser._id,
      amountBefore: amount,
      amountAfter: 0,
      usedAt: new Date(),
    },
  });

  debug(
    `积分继承成功：${amount} USDT 从 ${sourceBotUserId} 转移至 ${botUser._id}`,
  );

  await ctx.reply(
    `✅ *继承成功*\n\n已成功继承 *${amount} USDT* 积分到您的账号！`,
    { parse_mode: 'Markdown' },
  );
}
