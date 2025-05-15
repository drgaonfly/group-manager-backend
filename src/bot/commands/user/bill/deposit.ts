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

const depositCommand = new Composer<MyContext>();

const debug = createDebug('bot:deposit');

// 处理存款的主要逻辑
async function handleDeposit(ctx: MyContext) {
  debug('bot:deposit');

  const amount = ctx.match[2];

  if (!amount) {
    await ctx.reply('请使用正确的格式：+<金额>\n例如: +100 或 + 100');
    return;
  }

  const bot = ctx.currentBot;
  const group = ctx.currentGroup;

  // const botUser = ctx.currentBotUser;

  const transaction = new Transaction({
    id: await IdGen.next(Transaction, 'id', 6),
    bot,
    amount: Number(amount),
    botUser: ctx.currentBotUser,
    group: group,
    type: 'deposit',
    exchange_rate: group.exchange_rate,
    fee_rate: group.fee_rate,
  });

  await transaction.save();

  const renderSummary = useSummary();

  // 使用新的hook获取交易数据
  const { withdraws, deposits } = await useTransactionData(group);

  const message = await renderSummary({
    deposits,
    withdraws,
    feeRate: group.fee_rate,
    exchangeRate: group.exchange_rate,
    unit: group.unit,
  });

  await ctx.reply(message, { parse_mode: 'HTML' });
}

depositCommand.hears(
  /^(\+|入款)\s*(-?\d+\.?\d*)$/,
  checkGroup,
  isOperatorOrCreator,
  checkIsOnline,
  async (ctx) => {
    await handleDeposit(ctx);
  },
);

export default depositCommand;
