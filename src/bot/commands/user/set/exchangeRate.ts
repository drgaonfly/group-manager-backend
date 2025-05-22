import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import createDebug from 'debug';
import { isOperatorOrCreator } from '../../../../bot/middlewares/checkBotUser';
import { checkGroup } from '../../../../bot/middlewares/checkGroup';
import { checkPermission } from '../../../middlewares/checkPermission';

const setExchangeRateCommand = new Composer<MyContext>();

const debug = createDebug('bot:exchangeRate');

// 处理设置汇率命令
// setExchangeRateCommand.command('ex', async (ctx) => {
//   debug('ex');
//   // 发送长文本消息并附带 Inline Menu
//   await ctx.reply('输入: 设置美元汇率3 或 设置美元汇率 3 的格式即可设置汇率');
// });

setExchangeRateCommand.hears(
  /设置(.+)?汇率\s*(\d+\.?\d*)$/,
  checkGroup,
  checkPermission,
  isOperatorOrCreator,
  async (ctx) => {
    debug('exchangeRate');

    const exchangeRate = ctx.match[2];
    const currency = ctx.match[1] || 'USD'; // 如果没有指定货币单位，默认使用美元

    debug('exchangeRate', exchangeRate, currency); // 输出匹配到的货币单位和汇率，用于调试和日志记录

    if (!exchangeRate) {
      await ctx.reply(
        '请使用正确的格式：设置<货币>汇率 <汇率>\n例如: 设置美元汇率 6.8 或 设置EUR汇率6.8',
      );
      return;
    }

    // 更新用户的汇率设置和货币单位
    ctx.currentGroup.exchange_rate = Number(exchangeRate);
    ctx.currentGroup.unit = currency;
    await ctx.currentGroup.save();

    await ctx.reply(`${currency}汇率已成功设置为 ${exchangeRate}`);
  },
);

export default setExchangeRateCommand;
