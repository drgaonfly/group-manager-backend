import NightMode from '../../models/nightMode';
import Group from '../../models/group';
import Bot from '../../models/bot';
import { setupBot } from '../../bot/botSetup';

function isInNightRange(
  startAt: number,
  endAt: number,
  nowMinutes: number,
): boolean {
  if (startAt <= endAt) {
    return nowMinutes >= startAt && nowMinutes < endAt;
  } else {
    // 跨午夜
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
    const inNight = isInNightRange(config.startAt, config.endAt, nowMinutes);

    // 状态未变化，跳过，不调用 Telegram API
    if (inNight && config.isBanned) {
      console.log(`[NightMode] 已禁言中，跳过 configId=${config._id}`);
      continue;
    }
    if (!inNight && !config.isBanned) {
      console.log(
        `[NightMode] 未在区间内且未禁言，跳过 configId=${config._id}`,
      );
      continue;
    }

    const bot = await Bot.findById(config.bot);
    const group = await Group.findById(config.group);

    console.log(
      `[NightMode] 配置 id=${config._id} startAt=${config.startAt} endAt=${config.endAt} isBanned=${config.isBanned} inNight=${inNight}`,
    );
    console.log(
      `[NightMode] bot=${bot?.botName} isOnline=${bot?.isOnline} type=${bot?.type}`,
    );
    console.log(`[NightMode] group=${group?.title} id=${group?.id}`);

    if (!bot || !group || !bot.isOnline) {
      console.log(`[NightMode] 跳过：bot 或 group 无效或离线`);
      continue;
    }

    if (bot.type === 'private' && bot.disabledAt && bot.disabledAt < now) {
      console.log(`[NightMode] 跳过：Bot 已过期 botName=${bot.botName}`);
      continue;
    }

    try {
      const telegramBot = setupBot(bot.token);
      const chatId: number = group.id;

      if (inNight) {
        // 进入区间 → 禁言
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
        await NightMode.findByIdAndUpdate(config._id, { isBanned: true });
        console.log(
          `[NightMode] 🌙 夜间模式开启: group=${chatId} (${group.title})`,
        );
      } else {
        // 离开区间 → 解禁
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
        await NightMode.findByIdAndUpdate(config._id, { isBanned: false });
        console.log(
          `[NightMode] ☀️ 夜间模式关闭: group=${chatId} (${group.title})`,
        );
      }
    } catch (err: any) {
      console.log(
        `[NightMode] setChatPermissions 失败 groupId=${group.id}: ${err.message}`,
      );
    }
  }
}
