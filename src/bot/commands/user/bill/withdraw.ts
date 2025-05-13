import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import createDebug from 'debug';
import Transaction from '../../../../models/transaction';
import { IdGen } from '../../../../utils/idGen';
import { useSummary } from '../../../../utils/useEjsMessage';
import { useTransactionData } from '../../../hook/summary';
import { isOperatorOrCreator } from '../../../../bot/middlewares/checkBotUser';
import { checkGroup } from '../../../../bot/middlewares/checkGroup';

const withdrawCommand = new Composer<MyContext>();

const debug = createDebug('bot:withdraw');

withdrawCommand.hears(
  /^(下发)\s*(\d+)$/,
  checkGroup,
  isOperatorOrCreator,
  async (ctx) => {
    debug('bot:withdraw');

    const amount = ctx.match[2];
    if (!amount) {
      await ctx.reply(
        '请使用正确的格式：下发<金额>\n例如: 下发100 或 下发 100',
      );
      return;
    }

    const bot = ctx.currentBot;

    // const existingBotUser = ctx.currentBotUser;

    const transaction = new Transaction({
      id: await IdGen.next(Transaction, 'id', 6),
      bot,
      amount: Number(amount),
      botUser: ctx.currentBotUser,
      group: ctx.currentGroup,
      type: 'withdraw',
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

export default withdrawCommand;
