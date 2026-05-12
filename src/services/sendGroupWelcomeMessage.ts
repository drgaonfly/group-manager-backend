import { InlineKeyboard, InputFile } from 'grammy';
import { MyContext } from '../bot/types';
import { generateLocalSignedUrl } from '../utils/generateSignedUrl';
import { getMediaType } from '../utils/mediaUtils';
import { replaceMessageVariables } from '../utils/telegramHtmlConvert';
import { formatBeijingDate } from '../utils/formatBeijingDate';
import { IGroupWelcome } from '../models/groupWelcome';
import createDebug from 'debug';

const debug = createDebug('bot:group-welcome');

/**
 * 发送群组欢迎消息的服务函数
 * @param ctx Telegram Bot 上下文
 * @param username 用户名（@格式）
 * @param memberName 用户真实姓名
 * @param groupWelcome 群欢迎配置
 */
export const sendGroupWelcomeMessage = async (
  ctx: MyContext,
  username: string,
  memberName: string,
  groupWelcome?: IGroupWelcome,
) => {
  // 如果没有配置群欢迎消息，使用默认消息
  if (
    !groupWelcome ||
    (!groupWelcome.contents?.length && !groupWelcome.medias?.length)
  ) {
    const defaultMessage = `欢迎 ${username} 加入群组！👋`;
    await ctx.reply(defaultMessage);
    return;
  }

  // 构建内联键盘
  let keyboard: InlineKeyboard | undefined;
  if (groupWelcome.menus && groupWelcome.menus.length > 0) {
    keyboard = new InlineKeyboard();
    groupWelcome.menus.forEach((menu, index) => {
      keyboard!.url(menu.name, menu.url);
      // 每行最多3个按钮
      if ((index + 1) % 3 === 0) {
        keyboard!.row();
      }
    });
  }

  // 准备变量替换数据
  const variables = {
    username,
    memberName,
    userId: ctx.from?.id?.toString() || '',
    groupTitle: ctx.chat?.title || '本群',
    currentTime: formatBeijingDate(new Date()),
    currentBot: `@${ctx.currentBot?.userName}`,
  };

  // 收集所有发送的消息ID，用于阅后即焚
  const sentMessageIds: number[] = [];

  // 判断是否有文本内容和媒体
  const hasContents = groupWelcome.contents && groupWelcome.contents.length > 0;
  const hasMedias = groupWelcome.medias && groupWelcome.medias.length > 0;

  // 1. 先发送所有的文本内容（welcome_message）
  if (hasContents) {
    for (let i = 0; i < groupWelcome.contents.length; i++) {
      const content = groupWelcome.contents[i];
      const processedContent = replaceMessageVariables(content, variables);

      try {
        const sentMsg = await ctx.reply(processedContent, {
          parse_mode: 'HTML',
        });
        sentMessageIds.push(sentMsg.message_id);
      } catch (error) {
        debug('Failed to send welcome content:', error);
      }
    }
  }

  // 2. 发送媒体文件（media_caption 和 welcome_medias 一起发）
  if (hasMedias) {
    try {
      const processedCaption = groupWelcome.caption
        ? replaceMessageVariables(groupWelcome.caption, variables)
        : undefined;

      if (groupWelcome.medias.length === 1) {
        // 单个媒体文件
        const mediaUrl = groupWelcome.medias[0];
        const processedMediaUrl = await generateLocalSignedUrl(mediaUrl);
        const mediaType = getMediaType(mediaUrl);

        if (mediaType === 'video') {
          const sentMsg = await ctx.replyWithVideo(
            new InputFile({ url: processedMediaUrl }),
            {
              caption: processedCaption,
              reply_markup: keyboard,
              parse_mode: 'HTML',
            },
          );
          sentMessageIds.push(sentMsg.message_id);
        } else {
          const sentMsg = await ctx.replyWithPhoto(
            new InputFile({ url: processedMediaUrl }),
            {
              caption: processedCaption,
              reply_markup: keyboard,
              parse_mode: 'HTML',
            },
          );
          sentMessageIds.push(sentMsg.message_id);
        }
      } else {
        // 多个媒体文件，使用 sendMediaGroup
        const media = await Promise.all(
          groupWelcome.medias.map(async (mediaUrl: string, idx: number) => {
            const processedMediaUrl = await generateLocalSignedUrl(mediaUrl);
            const mediaType = getMediaType(mediaUrl);

            return {
              type: mediaType as 'photo' | 'video',
              media: new InputFile({ url: processedMediaUrl }),
              // caption 放在第一个媒体上
              ...(idx === 0 && processedCaption
                ? { caption: processedCaption, parse_mode: 'HTML' }
                : {}),
            };
          }),
        );

        const mediaGroupMessages = await ctx.api.sendMediaGroup(
          ctx.chat!.id,
          media as any,
        );
        mediaGroupMessages.forEach((msg) =>
          sentMessageIds.push(msg.message_id),
        );

        // 如果有键盘，单独发送一条带键盘的消息
        if (keyboard) {
          const sentMsg = await ctx.reply('👆 欢迎查看上方内容', {
            reply_markup: keyboard,
          });
          sentMessageIds.push(sentMsg.message_id);
        }
      }
    } catch (error) {
      debug('Failed to send media group:', error);
      if (keyboard) {
        try {
          const sentMsg = await ctx.reply('📎 媒体文件发送失败', {
            reply_markup: keyboard,
          });
          sentMessageIds.push(sentMsg.message_id);
        } catch (keyboardError) {
          debug('Failed to send keyboard fallback:', keyboardError);
        }
      }
    }
  }

  // 3. 如果既没有内容也没有媒体，但有键盘，发送默认消息和键盘
  if (!hasContents && !hasMedias && keyboard) {
    const defaultMessage = `欢迎 ${username} 加入群组！👋`;
    const sentMsg = await ctx.reply(defaultMessage, { reply_markup: keyboard });
    sentMessageIds.push(sentMsg.message_id);
  }

  // 4. 置顶新成员：如果开启了置顶功能，发送专门的置顶消息
  if (groupWelcome.pinNewMember) {
    try {
      // 检查机器人是否有置顶权限
      const botMember = await ctx.api.getChatMember(ctx.chat!.id, ctx.me.id);
      const canPin =
        botMember.status === 'administrator' &&
        botMember.can_pin_messages === true;

      if (canPin) {
        // 发送专门用于置顶的消息
        const pinMessage = await ctx.reply(`📌 新成员 ${username} 已加入群组`);

        // 置顶这条消息
        await ctx.api.pinChatMessage(ctx.chat!.id, pinMessage.message_id, {
          disable_notification: true, // 静默置顶，不发送通知
        });

        debug(`✅ Pinned new member message for: ${username}`);

        // 5分钟后自动取消置顶并删除消息
        setTimeout(
          async () => {
            try {
              await ctx.api.unpinChatMessage(
                ctx.chat!.id,
                pinMessage.message_id,
              );
              await ctx.api.deleteMessage(ctx.chat!.id, pinMessage.message_id);
              debug(
                `✅ Auto-unpinned and deleted pin message for: ${username}`,
              );
            } catch (error) {
              debug('❌ Failed to auto-unpin message:', error);
            }
          },
          5 * 60 * 1000,
        ); // 5分钟后自动取消置顶并删除消息
      } else {
        debug('⚠️ Bot does not have permission to pin messages in this group');
      }
    } catch (error) {
      debug('❌ Failed to pin new member message:', error);
    }
  }

  // 5. 阅后即焚：如果设置了删除时间，则在指定秒数后删除所有发送的消息
  if (
    groupWelcome.deleteAfterSeconds &&
    groupWelcome.deleteAfterSeconds > 0 &&
    sentMessageIds.length > 0
  ) {
    debug(
      `Setting up auto-delete for ${sentMessageIds.length} messages after ${groupWelcome.deleteAfterSeconds} seconds`,
    );

    setTimeout(async () => {
      for (const messageId of sentMessageIds) {
        try {
          await ctx.api.deleteMessage(ctx.chat!.id, messageId);
          debug(`Deleted message ${messageId} from chat ${ctx.chat!.id}`);
        } catch (error) {
          debug(`Failed to delete message ${messageId}:`, error);
        }
      }
    }, groupWelcome.deleteAfterSeconds * 1000);
  }
};
