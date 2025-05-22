import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import createDebug from 'debug';
import { isOperatorOrCreator } from '../../../../bot/middlewares/checkBotUser';
import { checkGroup } from '../../../../bot/middlewares/checkGroup';
import { checkPermission } from '../../../middlewares/checkPermission';

const setFeeRateCommand = new Composer<MyContext>();

const debug = createDebug('bot:fee');

setFeeRateCommand.hears(
  /设置费率\s*(\d+\.?\d*)\s*(%)?$/,
  checkGroup,
  checkPermission,
  isOperatorOrCreator,
  async (ctx) => {
    debug('fee');

    const feeRate = ctx.match[1];
    if (!feeRate) {
      await ctx.reply(
        '请使用正确的格式：设置费率 <费率>\n例如: 设置费率 3 或 设置费率2.5',
      );
      return;
    }

    // 更新 ctx.botUser 的费率
    ctx.currentGroup.fee_rate = Number(feeRate);
    await ctx.currentGroup.save();

    await ctx.reply(`费率已成功设置为 ${feeRate}%`);
  },
);

export default setFeeRateCommand;
