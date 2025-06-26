import { InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import { ITEMS_PER_PAGE } from '../../../../constants';
import Wallet from '../../../../models/wallet';
import createDebug from 'debug';
import BotUser from '../../../../models/botUser';
import Bot from '../../../../models/bot';

const debug = createDebug('bot:wallet:handleWalletList');

type WalletListMode = 'delete' | 'set' | null;

export const handleWalletList = async (
  ctx: MyContext,
  page = 1,
  mode: WalletListMode = null,
) => {
  // 使用 limit/skip 进行分页
  const skip = (page - 1) * ITEMS_PER_PAGE;

  // 先查总数
  const totalItems = await Wallet.countDocuments();
  debug('totalItems', totalItems);

  if (totalItems === 0) {
    await ctx.reply('暂无可用商品');
    return;
  }

  // 分页查找
  const wallets = await Wallet.find()
    .sort('-createdAt')
    .skip(skip)
    .limit(ITEMS_PER_PAGE);

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  const keyboard = new InlineKeyboard();
  for (const item of wallets) {
    if (mode === null) {
      keyboard
        .text(
          `${item.address} ${item.remark ? `[${item.remark}]` : ' '}`,
          'view_wallet',
        )
        .row();
    } else {
      keyboard
        .text(
          `${item.address} ${item.remark ? `[${item.remark}]` : ' '}`,
          `${mode}_${item._id}`,
        )
        .row();
    }
  }

  if (page > 1) {
    keyboard.text('« 上一页', `wallet_page_${page - 1}`);
  }
  if (page < totalPages) {
    keyboard.text('下一页 »', `wallet_page_${page + 1}`);
  }

  const pageInfo = totalPages > 1 ? `（第 ${page}/${totalPages} 页）` : '';

  let actionText;

  if (mode === 'delete') {
    actionText = '删除';
  } else if (mode === 'set') {
    actionText = '设置';
  } else {
    actionText = '查看';
  }

  const replyText = [
    `${
      actionText !== '查看'
        ? `<b>🏦选择你需要${actionText}的地址：</b>`
        : '更新结果'
    }`,
    '\n',
    `${pageInfo}`,
  ].join('\n');

  await ctx.reply(replyText, { reply_markup: keyboard, parse_mode: 'HTML' });
};

export const handleWalletListWithoutInlineMenu = async (
  ctx: MyContext,
  page = 1,
): Promise<{ pageInfo: string; replyText: string }> => {
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

  // 使用 limit/skip 进行分页
  const skip = (page - 1) * ITEMS_PER_PAGE;

  // 先查总数
  const totalItems = await Wallet.countDocuments({
    isOnline: true,
  });
  debug('totalItems', totalItems);

  if (totalItems === 0) {
    return {
      pageInfo: '',
      replyText: '暂无可用地址',
    };
  }

  // 分页查找
  const wallets = await Wallet.find({
    botUser: botUser._id,
    bot: bot._id,
    isOnline: true,
  })
    .sort('-createdAt')
    .skip(skip)
    .limit(ITEMS_PER_PAGE);

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  const pageInfo =
    totalPages > 1
      ? `（第 ${page}/${totalPages} 页）, 每页 ${ITEMS_PER_PAGE} 条记录`
      : '';

  const replyText = `\n<b>🏦 您的监控地址列表：</b>\n\n${wallets
    .map(
      (wallet) =>
        `<code>${wallet.address}</code> ${
          wallet.remark ? `[${wallet.remark}]` : ' '
        }`,
    )
    .join('\n')}`;

  return {
    pageInfo,
    replyText,
  };
};
