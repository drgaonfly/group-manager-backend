import { Bot } from 'grammy';

export const sendAuctionMessage = async (
  bot: Bot,
  chatId: number | string,
  message: string,
  keyboard?: any,
  media?: string,
  mediaType?: 'image' | 'video',
  shouldPin: boolean = false,
) => {
  try {
    let sentMessage;

    if (media && mediaType) {
      // 发送带媒体的消息
      if (mediaType === 'image') {
        sentMessage = await bot.api.sendPhoto(chatId, media, {
          caption: message,
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
      } else if (mediaType === 'video') {
        sentMessage = await bot.api.sendVideo(chatId, media, {
          caption: message,
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
      }
    } else {
      // 发送纯文本消息
      sentMessage = await bot.api.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
        link_preview_options: { is_disabled: true },
      });
    }

    // 置顶消息
    if (shouldPin && sentMessage?.message_id) {
      try {
        await bot.api.pinChatMessage(chatId, sentMessage.message_id);
      } catch (pinError) {
        console.error('置顶竞拍消息失败:', pinError);
      }
    }

    return sentMessage;
  } catch (error) {
    console.error('发送竞拍消息失败:', error);
    throw error;
  }
};
