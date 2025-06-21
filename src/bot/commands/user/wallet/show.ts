import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import { handleWalletListWithoutInlineMenu } from './handleWalletList';
import { formatBeijingDate } from '../../../../utils/formatBeijingDate';
import axios from 'axios';
import createDebug from 'debug';

const debug = createDebug('bot:wallet:show');

const walletShowComposer = new Composer<MyContext>();

export const handleShow = async (ctx: MyContext, page = 1) => {
  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: '➕ 添加地址', callback_data: 'wallet_add_address' },
        { text: '⚙️ 设置地址', callback_data: 'wallet_set_address' },
        { text: '🗑 删除地址', callback_data: 'wallet_delete_address' },
      ],
      [{ text: '❌ 取消', callback_data: 'close' }],
    ],
  };
  const { replyText } = await handleWalletListWithoutInlineMenu(page);

  await ctx.reply(replyText, {
    parse_mode: 'HTML',
    reply_markup: inlineKeyboard,
  });
};

const formatTransaction = (tx: any, walletAddress: string) => {
  // 只处理USDT转账交易
  if (
    !tx.trigger_info ||
    tx.trigger_info.methodName !== 'transfer' ||
    tx.trigger_info.contract_address !== 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
  ) {
    return null;
  }

  const date = new Date(tx.timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');

  const amount = (Number(tx.trigger_info.parameter._value) / 1_000_000).toFixed(
    2,
  );
  const type = tx.ownerAddress === walletAddress ? '－' : '＋';

  return `${month}-${day} ${hour}:${minute}:${second} [USDT]${type}<a href="https://tronscan.org/#/transaction/${tx.hash}">${amount}</a>`;
};

const formatWalletInfo = async (address: string, data: any, ctx: MyContext) => {
  const trxBalance = (data.balance / 1_000_000).toFixed(6);
  const usdtToken = data.trc20token_balances?.find(
    (token: any) => token.tokenAbbr === 'USDT',
  );
  const usdtBalance = usdtToken
    ? (usdtToken.balance / 1_000_000).toFixed(5)
    : '0';

  const bandwidth = data.bandwidth;
  const energyRemaining = bandwidth.energyRemaining;
  const energyLimit = bandwidth.energyLimit;
  const netRemaining = bandwidth.netRemaining;
  const netLimit = bandwidth.netLimit;

  const formattedCreatedDate = formatBeijingDate(data.date_created);

  // 获取最近交易
  const txResponse = await axios.get(
    `https://apilist.tronscan.org/api/transaction?address=${address}&limit=20&sort=-timestamp&contract_address=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`,
  );

  const recentTxs = txResponse.data.data
    .map((tx) => formatTransaction(tx, address))
    .filter(Boolean)
    .slice(0, 5)
    .join('\n');

  return [
    `@${ctx.currentBot.botName} 的钱包查询`,
    '',
    `查询地址：<code>${address}</code>`,
    `TRX余额：${trxBalance}`,
    `usdt余额：${usdtBalance}`,
    `质押冻结：${data.totalFrozen || 0}`,
    `可用能量：${energyRemaining} / ${energyLimit}`,
    `可用带宽：${netRemaining} / ${netLimit}`,
    `交易总数：${data.totalTransactionCount} 笔交易`,
    `收支比例：收${data.transactions_in} / 付${data.transactions_out}`,
    `创建时间：${formattedCreatedDate}`,
    '',
    `多签授权：${data.activePermissions?.length > 1 ? '已多签⚠️' : '未多签✅'}`,
    '',
    '最近交易：',
    recentTxs,
  ].join('\n');
};

walletShowComposer.hears(/^🏦 地址监听$/, async (ctx) => {
  debug('🏦 地址监听');

  await handleShow(ctx, 1);
});

walletShowComposer.hears(/T[a-zA-Z0-9]{33}$/, async (ctx, next) => {
  // 是否在对话状态 conversation

  if (ctx.conversation.active()) {
    next();
  } else {
    const address = ctx.match[0];

    if (!/T[a-zA-Z0-9]{33}$/.test(address)) {
      await ctx.reply('❌ 请输入有效的波场地址格式');
      return;
    }

    try {
      const response = await axios.get(
        `https://apilist.tronscan.org/api/account?address=${address}`,
      );

      const formattedResponse = await formatWalletInfo(
        address,
        response.data,
        ctx,
      );
      await ctx.reply(formattedResponse, { parse_mode: 'HTML' });
    } catch (error) {
      await ctx.reply('获取钱包信息失败，请稍后重试。');
    }
  }
});

export default walletShowComposer;
