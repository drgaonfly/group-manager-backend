import NightMode from '../../models/nightMode';
import Group from '../../models/group';
import Bot from '../../models/bot';
import { setupBot } from '../../bot/botSetup';

export async function checkNightModes() {
  const now = new Date();
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  console.log(`[NightMode] 检查夜间模式，当前 UTC 分钟: ${nowMinutes}`);

  const configs = await NightMode.find({ isActive: true });

  if (!configs.length) {
    console.log('[NightMode] 无夜间模式配置，跳过');
    return;
  }

  for (const config of configs) {
    const bot = await Bot.findById(config.bot);
    const group = await Group.findById(config.group);

    if (!bot || !group || !bot.isOnline) continue;

    // public Bot 不受付费限制；private Bot 过期后跳过
    if (bot.type === 'private') {
      if (bot.disabledAt && bot.disabledAt < now) {
        console.log(`[NightMode] 跳过: Bot 已过期 botName=${bot.botName}`);
        continue;
      }
    }

    const atStart = nowMinutes === config.startAt;
    const atEnd = nowMinutes === config.endAt;

    if (!atStart && !atEnd) continue;

    try {
      const telegramBot = setupBot(bot.token);
      const chatId: number = group.id;

      if (atStart) {
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
        console.log(
          `[NightMode] 🌙 夜间模式开启: group=${chatId} (${group.title})`,
        );
      } else if (atEnd) {
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
