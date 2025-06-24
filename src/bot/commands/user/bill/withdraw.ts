import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import createDebug from 'debug';
import Transaction from '../../../../models/transaction';
import { IdGen } from '../../../../utils/idGen';
import { useSummary } from '../../../../utils/useEjsMessage';
import { useTransactionData } from '../../../hook/summary';
import { isOperatorOrCreator } from '../../../../bot/middlewares/checkBotUser';
import { checkGroup } from '../../../../bot/middlewares/checkGroup';
import { checkIsOnline } from '../../../../bot/middlewares/checkIsOnline';
import { sendBillMessage } from './deposit';
import { checkPermission } from '../../../middlewares/checkPermission';

const withdrawCommand = new Composer<MyContext>();

const debug = createDebug('bot:withdraw');

withdrawCommand.hears(
  /^(下发|-)\s*(-?\d+\.?\d*)\s*(u|U)?$/,
  checkGroup,
  checkPermission,
  isOperatorOrCreator,
  checkIsOnline,
  async (ctx) => {
    debug('bot:withdraw');

    const amount = ctx.match[2];
    const hasUsdt = ctx.match[3];

    debug('hasUsdt', hasUsdt);

    if (!amount) {
      await ctx.reply(
        '请使用正确的格式：下发<金额>[u] [汇率]\n例如: 下发100 或 下发100u',
      );
      return;
    }

    const bot = ctx.currentBot;
    const group = ctx.currentGroup;

    const transaction = new Transaction({
      id: await IdGen.next(Transaction, 'id', 6),
      bot,
      amount: hasUsdt ? Number(amount) * group.exchange_rate : Number(amount),
      botUser: ctx.currentBotUser,
      group: group,
      type: 'withdraw',
      exchange_rate: group.exchange_rate,
      fee_rate: group.fee_rate,
      usdt_amount: hasUsdt ? Number(amount) : undefined,
    });

    await transaction.save();

    debug('transaction', transaction);

    const renderSummary = useSummary();

    // 使用新的hook获取交易数据
    const { withdraws, deposits, summary } = await useTransactionData(group);

    const message = await renderSummary({
      deposits,
      withdraws,
      feeRate: group.fee_rate,
      summary,
      exchangeRate: group.exchange_rate,
      unit: group.unit,
    });

    let needFullBill = false;

    if (deposits.length >= 5 || withdraws.length >= 5) {
      needFullBill = true;
    }

    await sendBillMessage(ctx, message, group, needFullBill);
  },
);

export default withdrawCommand;
