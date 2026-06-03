import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import { checkRedPacket } from '../../../middlewares/checkRedPacket';
import { checkGroup } from '../../../middlewares/checkGroup';
import createDebug from 'debug';

const debug = createDebug('bot:redpacket:command');

const redpacketCommand = new Composer<MyContext>();

redpacketCommand.command(
  'redpacket',
  checkGroup,
  checkRedPacket,
  async (ctx) => {
    debug('红包命令触发');

    // const botId = ctx.currentBot._id;
    const botUserId = ctx.currentBotUser?._id;
    const groupId = ctx.currentGroup?._id;

    if (!botUserId || !groupId) {
      await ctx.reply('❌ 无法识别用户或群组信息');
      return;
    }

    const startParam = `rp_${groupId}`;
    const keyboard = new InlineKeyboard().url(
      '🧧 去私聊发红包',
      `https://t.me/${ctx.me.username}?start=${startParam}`,
    );

    await ctx.reply('💰 点击下方按钮，在私聊中打开红包页面', {
      reply_markup: keyboard,
    });
  },
);

export default redpacketCommand;
