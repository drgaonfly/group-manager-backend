import { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { convertToTelegramHtml } from './telegramHtml';

/**
 * 发送抽奖消息（支持媒体和置顶）
 * @param bot Telegram Bot实例
 * @param chatId 聊天ID
 * @param message 消息文本
 * @param keyboard 按钮键盘
 * @param media 媒体URL（可选）
 * @param mediaType 媒体类型（可选）
 * @param pin 是否置顶消息（可选）
 */
export async function sendLotteryMessage(
  bot: Bot,
  chatId: string | number,
  message: string,
  keyboard?: InlineKeyboard,
  media?: string,
  mediaType?: 'image' | 'video',
  pin?: boolean,
) {
  console.log('=== 🎯 sendLotteryMessage 调试信息 ===');
  console.log('📥 接收参数:', {
    chatId,
    hasKeyboard: !!keyboard,
    media,
    mediaType,
    messageLength: message.length,
    pin: pin,
    pinType: typeof pin,
    pinValue:
      pin === true ? '✅ 需要置顶' : pin === false ? '❌ 不置顶' : '⚠️ 未定义',
  });

  const options: any = {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  };

  try {
    // 转换HTML为Telegram兼容格式
    const telegramMessage = convertToTelegramHtml(message);
    console.log('🔄 HTML转换:', {
      original: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
      converted:
        telegramMessage.substring(0, 100) +
        (telegramMessage.length > 100 ? '...' : ''),
    });

    let sentMessage;

    if (media && mediaType) {
      // 如果是相对路径，转换为完整URL
      let mediaUrl = media;
      if (media.startsWith('/')) {
        const baseUrl = process.env.BACKEND_URL || 'http://localhost:5007';
        mediaUrl = `${baseUrl}${media}`;
        console.log(`🔗 转换相对路径为完整URL: ${media} -> ${mediaUrl}`);
      }

      console.log(`📷 发送${mediaType}媒体消息到 ${chatId}, URL: ${mediaUrl}`);
      // 有媒体时，文本作为caption
      if (mediaType === 'image') {
        sentMessage = await bot.api.sendPhoto(chatId, mediaUrl, {
          ...options,
          caption: telegramMessage,
        });
      } else if (mediaType === 'video') {
        sentMessage = await bot.api.sendVideo(chatId, mediaUrl, {
          ...options,
          caption: telegramMessage,
        });
      }
    } else {
      console.log(`💬 发送普通文本消息到 ${chatId}`);
      // 无媒体时，发送普通文本消息
      sentMessage = await bot.api.sendMessage(chatId, telegramMessage, {
        ...options,
        link_preview_options: { is_disabled: true },
      });
    }

    console.log('📤 消息发送结果:', {
      messageId: sentMessage?.message_id,
      success: !!sentMessage,
    });

    // 置顶消息逻辑
    console.log('📌 置顶检查:', {
      shouldPin: !!pin,
      hasMessageId: !!sentMessage?.message_id,
      willAttemptPin: !!(pin && sentMessage?.message_id),
    });

    if (pin && sentMessage?.message_id) {
      try {
        console.log(
          `🔄 尝试置顶消息 ${sentMessage.message_id} 到聊天 ${chatId}`,
        );
        await bot.api.pinChatMessage(chatId, sentMessage.message_id);
        console.log(`✅ 消息 ${sentMessage.message_id} 置顶成功！`);
      } catch (error: any) {
        console.error(`❌ 置顶消息失败:`, {
          error: error.message,
          code: error.error_code,
          description: error.description,
          chatId,
          messageId: sentMessage.message_id,
        });

        // 检查常见的置顶失败原因
        if (error.description?.includes('not enough rights')) {
          console.error(
            '💡 机器人没有置顶消息的权限，请确保机器人是群组管理员且有置顶消息权限',
          );
        } else if (error.description?.includes('message not found')) {
          console.error('💡 消息未找到，可能已被删除');
        } else if (error.description?.includes('chat not found')) {
          console.error('💡 聊天未找到，可能机器人已被移出群组');
        }
      }
    } else if (pin && !sentMessage?.message_id) {
      console.warn('⚠️ 需要置顶但消息ID不存在');
    } else if (!pin) {
      console.log('ℹ️ 不需要置顶消息');
    }

    console.log('=== 🎯 sendLotteryMessage 结束 ===\n');
    return sentMessage;
  } catch (error) {
    console.error(`❌ 发送消息到 ${chatId} 失败:`, error);
    throw error;
  }
}
