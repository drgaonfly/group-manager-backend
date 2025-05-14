import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import createDebug from 'debug';
import { isOperatorOrCreator } from '../../../../bot/middlewares/checkBotUser';
import { checkGroup } from '../../../../bot/middlewares/checkGroup';

const setExchangeRateCommand = new Composer<MyContext>();

const debug = createDebug('bot:ex');

// 处理设置汇率命令
// setExchangeRateCommand.command('ex', async (ctx) => {
//   debug('ex');
//   // 发送长文本消息并附带 Inline Menu
//   await ctx.reply('输入: 设置美元汇率3 或 设置美元汇率 3 的格式即可设置汇率');
// });

setExchangeRateCommand.hears(
  /设置(美元|USD)?汇率\s*(\d+\.?\d*)$/,
  checkGroup,
  isOperatorOrCreator,
  async (ctx) => {
    debug('ex');

    const exchangeRate = ctx.match[2];
    const currency = ctx.match[1] || '美元'; // 如果匹配到美元就用美元，否则默认美元

    if (!exchangeRate) {
      await ctx.reply(
        '请使用正确的格式：/设置美元汇率 <汇率>\n例如: /设置美元汇率 6.8 或 /美元汇率6.8',
      );
      return;
    }

    // 更新用户的汇率设置
    ctx.currentGroup.exchange_rate = Number(exchangeRate);
    await ctx.currentGroup.save();

    await ctx.reply(`${currency}汇率已成功设置为 ${exchangeRate}`);
  },
);

export default setExchangeRateCommand;
