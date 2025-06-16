import { InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import { ITEMS_PER_PAGE } from '../../../../constants';
import Wallet from '../../../../models/wallet';
import createDebug from 'debug';

const debug = createDebug('bot:wallet:handleWalletList');

export const handleWalletList = async (
  ctx: MyContext,
  page = 1,
  isDelete = false,
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
    keyboard
      .text(
        `${item.address} ${item.remark ? `[${item.remark}]` : ' '}`,
        isDelete ? `delete_${item._id}` : `set_${item._id}`,
      )
      .row();
  }

  if (page > 1) {
    keyboard.text('« 上一页', `wallet_page_${page - 1}`);
  }
  if (page < totalPages) {
    keyboard.text('下一页 »', `wallet_page_${page + 1}`);
  }

  const pageInfo = totalPages > 1 ? `（第 ${page}/${totalPages} 页）` : '';
  const replyText = `<b>🏦选择你需要${
    isDelete ? '删除' : '设置'
  }的地址：</b>\n${pageInfo ? `\n\n${pageInfo}` : ''}`;

  await ctx.reply(replyText, { reply_markup: keyboard, parse_mode: 'HTML' });
};

export const handleWalletListWithoutInlineMenu = async (
  page = 1,
): Promise<{ pageInfo: string; replyText: string }> => {
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
      (wallet, index) =>
        `${index + 1}. ${wallet.address} ${
          wallet.remark ? `[${wallet.remark}]` : ' '
        }`,
    )
    .join('\n')}`;

  return {
    pageInfo,
    replyText,
  };
};
