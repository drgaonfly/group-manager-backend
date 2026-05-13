import { MyContext } from '../../../../types';
import Recharge from '../../../../../models/recharge';
import { IdGen } from '../../../../../utils/idGen';
import { findBotProxy } from '../../../../services/findBotProxy';
import * as QRCode from 'qrcode';
import { InputFile, InlineKeyboard } from 'grammy';
import { formatBeijingDate } from '../../../../../utils/formatBeijingDate';
import BotUser from '../../../../../models/botUser';
import Bot from '../../../../../models/bot';
import BotUserConfig from '../../../../../models/botUserConfig';
import createDebug from 'debug';
const debug = createDebug('bot:recharge:callback');

/**
 * 处理充值请求的通用方法
 * @param ctx Telegram上下文
 * @param amount 充值金额（整数部分）
 * @returns 处理结果，成功返回true，失败返回false
 */
export async function handleRechargeRequest(
  ctx: MyContext,
  amount: number,
): Promise<boolean> {
  debug('handleRechargeRequest-ctx', ctx);

  let bot = ctx.currentBot;
  let botUser = ctx.currentBotUser;

  if (!botUser) {
    botUser = await BotUser.findOne({
      id: ctx.update.callback_query.from.id.toString(),
    });
  }

  if (!bot) {
    bot = await Bot.findOne({ id: ctx.me.id.toString() });
  }

  debug('开始处理充值请求', { userId: botUser._id, amount });

  const address = bot.trx20_address;
  if (!address) {
    debug('未设置收款地址');
    await ctx.reply('机器人还未设置收款地址');
    return false;
  }

  // 检查是否存在未过期的相同金额充值订单
  debug('检查是否存在未过期的相同金额充值订单');
  const existingRecharge = await Recharge.findOne({
    status: 'pending',
    expiredAt: { $gt: new Date() },
    botUser: botUser._id,
    bot: bot._id,
  });

  let recharge;

  if (existingRecharge) {
    debug('存在未过期的充值订单，刷新过期时间', {
      id: existingRecharge.id,
    });
    // 刷新过期时间
    existingRecharge.expiredAt = new Date(Date.now() + 15 * 60 * 1000);
    await existingRecharge.save();
    recharge = existingRecharge;
  } else {
    debug('不存在未过期充值订单，创建新订单');

    // 生成不重复的随机金额（如 20.567），小数点后三位
    let uniqueAmount: number | undefined;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;
    const baseAmount = amount;

    const { proxyUser } = await findBotProxy(bot);

    debug('开始生成不重复的随机金额');
    while (!isUnique && attempts < maxAttempts) {
      // 生成 baseAmount 的 1% - 3% 随机小数
      const minPercent = 0.01;
      const maxPercent = 0.03;
      const randomPercent =
        minPercent + Math.random() * (maxPercent - minPercent);
      const randomAddition = Number((1 * randomPercent).toFixed(3));
      uniqueAmount = Number((baseAmount + randomAddition).toFixed(3));
      debug(`尝试生成金额: ${uniqueAmount}, 第 ${attempts + 1} 次尝试`);

      // 检查是否存在相同金额的待支付订单
      const existingAmountRecharge = await Recharge.findOne({
        amount: uniqueAmount,
        status: 'pending',
        expiredAt: { $gt: new Date() },
      });

      if (!existingAmountRecharge) {
        debug('生成唯一金额成功:', uniqueAmount);
        isUnique = true;
      } else {
        debug('金额重复，继续尝试');
      }
      attempts++;
    }

    if (!isUnique) {
      debug('无法生成唯一的支付金额，已达到最大尝试次数');
      await ctx.reply('无法生成唯一的支付金额，请重试');
      return false;
    }

    // 确保 currentBotUserConfig 存在，获取余额
    let botUserConfig = ctx.currentBotUserConfig;
    if (!botUserConfig && bot && botUser) {
      botUserConfig = await BotUserConfig.findOne({
        bot: bot._id,
        botUser: botUser._id,
      });
    }
    const balanceBefore = botUserConfig?.usdt_balance ?? 0;

    recharge = new Recharge({
      id: await IdGen.next(Recharge, 'id', 6),
      botUser: botUser._id,
      bot: bot._id,
      proxy: proxyUser._id,
      amount: uniqueAmount,
      to: address,
      status: 'pending',
      expiredAt: new Date(Date.now() + 10 * 60 * 1000),
      balance_before: balanceBefore,
    });

    await recharge.save();
    debug('新充值记录创建成功:', recharge.id);
  }

  if (!recharge) {
    debug('充值记录创建失败');
    await ctx.reply('充值记录创建失败，请重试');
    return false;
  }

  // 生成二维码
  debug('生成收款二维码', { address: recharge.to });
  const qrBuffer: any = await QRCode.toBuffer(recharge.to, {
    margin: 1,
    width: 200,
    errorCorrectionLevel: 'H',
  });

  debug('渲染充值消息', { id: recharge.id });
  // 这里直接写死文案，不用国际化
  const message = [
    `<b>充值订单</b>`,
    `订单号：<code>${recharge.id}</code>`,
    `充值金额：<b>${recharge.amount} USDT</b>`,
    `收款地址：<code>${recharge.to}</code>`,
    `创建时间：${formatBeijingDate(recharge.createdAt)}`,
    recharge.expiredAt
      ? `过期时间：${formatBeijingDate(recharge.expiredAt)}`
      : '',
    '',
    '\n请在10分钟内支付完成，否则订单失效。',
    '❗️❗️❗️❗️请使用 USDT-TRC20 网络转账，转账金额需与上方金额完全一致。',
    '转账完成后，系统会自动检测到账，无需手动提交。',
    '',
    '如有疑问请联系客服。',
  ]
    .filter(Boolean)
    .join('\n');

  const keyboard = new InlineKeyboard()
    .text('❌ 取消订单', `recharge:cancel_${recharge._id}`)
    .row()
    .text('🔄 再充一笔', 'recharge:again');

  // 优先 editMessageCaption，如果失败则 replyWithPhoto
  // 特定金额
  if (ctx.callbackQuery?.message?.message_id && ctx.currentBot) {
    try {
      debug('尝试 editMessageMedia 发送二维码');
      await ctx.replyWithPhoto(new InputFile(qrBuffer), {
        caption: message,
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
      debug('editMessageMedia 成功');
      return true;
    } catch (err: any) {
      debug('editMessageMedia 失败，fallback 到 replyWithPhoto', err);
      return false;
      // fallback to replyWithPhoto
    }
  }

  debug('使用 replyWithPhoto 发送二维码');
  await ctx.replyWithPhoto(new InputFile(qrBuffer), {
    caption: message,
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });

  debug('充值流程处理完毕');
  return true;
}
