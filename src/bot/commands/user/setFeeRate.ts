import { Composer } from 'grammy';
import { MyContext } from '../../types';
import createDebug from 'debug';

const setFeeRateCommand = new Composer<MyContext>();

const debug = createDebug('bot:fee');

// 处理设置费率命令
// setFeeRateCommand.command('fee', async (ctx) => {
//   debug('fee');
//   // 发送长文本消息并附带 Inline Menu

//   await ctx.reply('输入: 设置费率3 或 设置费率 3 的格式即可设置费率');
// });

setFeeRateCommand.hears(/^(\/)?设置费率\s*(\d+)(%)?$/, async (ctx) => {
  debug('fee');

  const feeRate = ctx.match[2];
  if (!feeRate) {
    await ctx.reply(
      '请使用正确的格式：/设置费率 <费率>\n例如: /设置费率 3 或 设置费率3',
    );
    return;
  }

  // 更新 ctx.botUser 的费率
  ctx.currentGroup.fee_rate = Number(feeRate);
  await ctx.currentGroup.save();

  await ctx.reply(`费率已成功设置为 ${feeRate}%`);
});

export default setFeeRateCommand;
