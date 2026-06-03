import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import RedPacket from '../../../../models/redPacket';
import BotUser from '../../../../models/botUser';
import createDebug from 'debug';

const debug = createDebug('bot:redpacket:webapp');

const webAppDataQuery = new Composer<MyContext>();

webAppDataQuery.on('message:web_app_data', async (ctx) => {
  const raw = ctx.message.web_app_data?.data;
  console.log('[webAppDataQuery] 收到 web_app_data, raw=', raw);
  if (!raw) return;

  let payload: { type?: string; groupId?: string };
  try {
    payload = JSON.parse(raw);
  } catch {
    return;
  }

  if (payload.type !== 'redpacket_created' || !payload.groupId) return;

  const groupId = payload.groupId;
  debug('收到 web_app_data groupId=%s', groupId);

  const botUser = ctx.currentBotUser;
  const bot = ctx.currentBot;
  if (!botUser || !bot) return;

  const redPacket = await RedPacket.findOne({
    bot: bot._id,
    group: groupId,
    creator: botUser._id,
    status: 'active',
    settled: false,
  })
    .sort({ createdAt: -1 })
    .populate('creator', 'userName firstName lastName')
    .lean();

  if (!redPacket) {
    await ctx.reply('❌ 未找到红包记录，请重试');
    return;
  }

  const creator = await BotUser.findById(redPacket.creator);

  const minutesLeft = Math.round(
    (new Date(redPacket.expiredAt).getTime() - Date.now()) / 60000,
  );

  const text = [
    `🧧 <b>红包来啦！</b>`,
    ``,
    `👤 发起人：${creator.userName}`,
    `💰 总积分：<b>${redPacket.totalPoints}</b>`,
    `📦 共 ${redPacket.totalSlots} 份，每份 <b>${redPacket.pointsPerSlot}</b> 积分`,
    redPacket.bombNumbers.length > 0
      ? `💣 炸弹数字：${redPacket.bombNumbers.join('、')}（踩雷扣 ${
          redPacket.bombMultiplier
        } 倍）`
      : `😊 无炸弹，安心领取`,
    ``,
    `⏰ ${minutesLeft} 分钟内有效`,
  ].join('\n');

  const keyboard = new InlineKeyboard().text(
    `🧧 抢红包（0/${redPacket.totalSlots}）`,
    `grab_rp_${redPacket._id}`,
  );

  try {
    const sent = await ctx.api.sendMessage(Number(groupId), text, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
    await RedPacket.findByIdAndUpdate(redPacket._id, {
      messageId: sent.message_id,
    });
    await ctx.reply('✅ 红包已发到群里，等待大家来抢！');
  } catch (e) {
    debug('发送红包群消息失败: %o', e);
    await ctx.reply('❌ 发送失败，请确认机器人在群内有发消息权限');
  }
});

export default webAppDataQuery;
