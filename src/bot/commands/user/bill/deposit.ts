import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import createDebug from 'debug';
import Transaction from '../../../../models/transaction';
import { IdGen } from '../../../../utils/idGen';
import { useSummary } from '../../../../utils/useEjsMessage';
import { useTransactionData } from '../../../hook/summary';
import { isOperatorOrCreator } from '../../../../bot/middlewares/checkBotUser';
import { checkGroup } from '../../../../bot/middlewares/checkGroup';

const depositCommand = new Composer<MyContext>();

const debug = createDebug('bot:deposit');

depositCommand.hears(
  /^(\+)\s*(\d+)$/,
  checkGroup,
  isOperatorOrCreator,
  async (ctx) => {
    debug('bot:withdraw');

    const amount = ctx.match[2];

    if (!amount) {
      await ctx.reply('请使用正确的格式：+<金额>\n例如: +100 或 + 100');
      return;
    }

    const bot = ctx.currentBot;

    // const botUser = ctx.currentBotUser;

    const transaction = new Transaction({
      id: await IdGen.next(Transaction, 'id', 6),
      bot,
      amount: Number(amount),
      botUser: ctx.currentBotUser,
      group: ctx.currentGroup,
      type: 'deposit',
      exchange_rate: ctx.currentGroup.exchange_rate,
      fee_rate: ctx.currentGroup.fee_rate,
    });

    await transaction.save();

    const renderSummary = useSummary();

    // 使用新的hook获取交易数据
    const { withdrawTimes, withdraws, depositTimes, deposits } =
      await useTransactionData(bot);

    const message = await renderSummary({
      depositTimes,
      deposits,
      withdrawTimes,
      withdraws,
      feeRate: ctx.currentGroup.fee_rate,
      exchangeRate: ctx.currentGroup.exchange_rate,
      unit: '元',
    });

    await ctx.reply(message, { parse_mode: 'HTML' });
  },
);

export default depositCommand;
