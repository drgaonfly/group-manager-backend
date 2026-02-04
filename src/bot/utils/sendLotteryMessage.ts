import { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { convertToTelegramHtml } from './telegramHtml';

/**
 * 发送抽奖消息（支持媒体）
 * @param bot Telegram Bot实例
 * @param chatId 聊天ID
 * @param message 消息文本
 * @param keyboard 按钮键盘
 * @param media 媒体URL（可选）
 * @param mediaType 媒体类型（可选）
 */
export async function sendLotteryMessage(
  bot: Bot,
  chatId: string | number,
  message: string,
  keyboard?: InlineKeyboard,
  media?: string,
  mediaType?: 'image' | 'video',
) {
  console.log('sendLotteryMessage called:', {
    chatId,
    hasKeyboard: !!keyboard,
    media,
    mediaType,
    messageLength: message.length,
  });

  const options: any = {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  };

  try {
    // 转换HTML为Telegram兼容格式
    const telegramMessage = convertToTelegramHtml(message);
    console.log('HTML转换:', {
      original: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
      converted:
        telegramMessage.substring(0, 100) +
        (telegramMessage.length > 100 ? '...' : ''),
    });

    if (media && mediaType) {
      // 如果是相对路径，转换为完整URL
      let mediaUrl = media;
      if (media.startsWith('/')) {
        const baseUrl = process.env.BACKEND_URL || 'http://localhost:5007';
        mediaUrl = `${baseUrl}${media}`;
        console.log(`转换相对路径为完整URL: ${media} -> ${mediaUrl}`);
      }

      console.log(`发送${mediaType}媒体消息到 ${chatId}, URL: ${mediaUrl}`);
      // 有媒体时，文本作为caption
      if (mediaType === 'image') {
        return await bot.api.sendPhoto(chatId, mediaUrl, {
          ...options,
          caption: telegramMessage,
        });
      } else if (mediaType === 'video') {
        return await bot.api.sendVideo(chatId, mediaUrl, {
          ...options,
          caption: telegramMessage,
        });
      }
    }

    console.log(`发送普通文本消息到 ${chatId}`);
    // 无媒体时，发送普通文本消息
    return await bot.api.sendMessage(chatId, telegramMessage, {
      ...options,
      link_preview_options: { is_disabled: true },
    });
  } catch (error) {
    console.error(`发送消息到 ${chatId} 失败:`, error);
    throw error;
  }
}
