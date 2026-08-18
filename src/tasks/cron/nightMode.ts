import NightMode from '../../models/nightMode';
import Group from '../../models/group';
import Bot from '../../models/bot';
import { setupBot } from '../../bot/botSetup';

/**
 * 判断 nowMinutes 是否处于 [startAt, endAt) 区间，支持跨午夜
 */
function isInNightRange(
  startAt: number,
  endAt: number,
  nowMinutes: number,
): boolean {
  if (startAt <= endAt) {
    return nowMinutes >= startAt && nowMinutes < endAt;
  } else {
    // 跨午夜，例如 startAt=1320 endAt=480
    return nowMinutes >= startAt || nowMinutes < endAt;
  }
}

export async function checkNightModes() {
  const now = new Date();
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  console.log(`[NightMode] 检查夜间模式，当前 UTC 分钟: ${nowMinutes}`);

  const configs = await NightMode.find({ isActive: true });

  if (!configs.length) {
    console.log('[NightMode] 无夜间模式配置，跳过');
    return;
  }

  console.log(`[NightMode] 找到 ${configs.length} 条配置`);

  for (const config of configs) {
    const bot = await Bot.findById(config.bot);
    const group = await Group.findById(config.group);

    console.log(
      `[NightMode] 配置 id=${config._id} startAt=${config.startAt} endAt=${config.endAt} isActive=${config.isActive}`,
    );
    console.log(
      `[NightMode] bot=${bot?.botName} isOnline=${bot?.isOnline} type=${bot?.type}`,
    );
    console.log(`[NightMode] group=${group?.title} id=${group?.id}`);

    if (!bot || !group || !bot.isOnline) {
      console.log(`[NightMode] 跳过：bot 或 group 无效或离线`);
      continue;
    }

    // private Bot 过期后跳过
    if (bot.type === 'private') {
      if (bot.disabledAt && bot.disabledAt < now) {
        console.log(`[NightMode] 跳过: Bot 已过期 botName=${bot.botName}`);
        continue;
      }
    }

    const inNight = isInNightRange(config.startAt, config.endAt, nowMinutes);
    console.log(
      `[NightMode] nowMinutes=${nowMinutes} startAt=${config.startAt} endAt=${config.endAt} inNight=${inNight}`,
    );

    try {
      const telegramBot = setupBot(bot.token);
      const chatId: number = group.id;

      if (inNight) {
        // 在区间内 → 禁言
        await telegramBot.api.setChatPermissions(chatId, {
          can_send_messages: false,
          can_send_audios: false,
          can_send_documents: false,
          can_send_photos: false,
          can_send_videos: false,
          can_send_video_notes: false,
          can_send_voice_notes: false,
          can_send_polls: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false,
          can_change_info: false,
          can_invite_users: false,
          can_pin_messages: false,
          can_manage_topics: false,
        });
        console.log(`[NightMode] 🌙 禁言中: group=${chatId} (${group.title})`);
      } else {
        // 不在区间内 → 解禁
        await telegramBot.api.setChatPermissions(chatId, {
          can_send_messages: true,
          can_send_audios: true,
          can_send_documents: true,
          can_send_photos: true,
          can_send_videos: true,
          can_send_video_notes: true,
          can_send_voice_notes: true,
          can_send_polls: true,
          can_send_other_messages: true,
          can_add_web_page_previews: true,
          can_change_info: false,
          can_invite_users: true,
          can_pin_messages: false,
          can_manage_topics: false,
        });
        console.log(`[NightMode] ☀️ 已解禁: group=${chatId} (${group.title})`);
      }
    } catch (err: any) {
      console.log(
        `[NightMode] setChatPermissions 失败 groupId=${group.id}: ${err.message}`,
      );
    }
  }
}
