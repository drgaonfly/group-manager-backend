import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import charger from '../../../menus/inline/charger';
import BotUserConfig from '../../../../models/botUserConfig';
import createDebug from 'debug';

const chargingBalanceCommand = new Composer<MyContext>();
const debug = createDebug('bot:charging-balance');

const keys = ['充值余额', 'Recharge']; // 支持中英文

// 监听"充值余额"文本消息
export async function handleChargingBalance(ctx: MyContext) {
  await ctx.conversation.exitAll();
  debug('充值余额命令被触发');

  // 确保 currentBotUserConfig 存在
  let botUserConfig = ctx.currentBotUserConfig;
  if (!botUserConfig && ctx.currentBot && ctx.currentBotUser) {
    botUserConfig = await BotUserConfig.findOne({
      bot: ctx.currentBot._id,
      botUser: ctx.currentBotUser._id,
    });
  }

  // 如果仍然不存在，使用默认值 0
  const balance = botUserConfig?.usdt_balance ?? 0;

  const message = [
    `💰请选择下面充值订单金额\n📈请严格按照小数点转账❗️❗️`,
    '',
    `💵当前余额:${balance} USDT`,
  ].join('\n');

  await ctx.reply(message, {
    reply_markup: charger,
  });
}

chargingBalanceCommand.hears(keys, async (ctx) => {
  await handleChargingBalance(ctx);
});

chargingBalanceCommand.callbackQuery('recharge', async (ctx) => {
  await handleChargingBalance(ctx);
});

export default chargingBalanceCommand;
