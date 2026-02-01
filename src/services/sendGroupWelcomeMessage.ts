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
  };

  // 收集所有发送的消息ID，用于阅后即焚
  const sentMessageIds: number[] = [];

  // 判断是否同时有文本内容和媒体
  const hasContents = groupWelcome.contents && groupWelcome.contents.length > 0;
  const hasMedias = groupWelcome.medias && groupWelcome.medias.length > 0;

  // 如果同时有文本和媒体，将文本合并作为media的caption
  if (hasContents && hasMedias) {
    // 合并所有文本内容，用换行符分隔
    const mergedCaption = groupWelcome.contents
      .map((content) => replaceMessageVariables(content, variables))
      .join('\n\n');

    try {
      if (groupWelcome.medias.length === 1) {
        // 单个媒体文件，发送时带caption
        const mediaUrl = groupWelcome.medias[0];
        const processedMediaUrl = await generateLocalSignedUrl(mediaUrl);
        const mediaType = getMediaType(mediaUrl);

        const shouldAddKeyboardToMedia = keyboard !== undefined;

        if (mediaType === 'video') {
          const sentMsg = await ctx.replyWithVideo(
            new InputFile({ url: processedMediaUrl }),
            {
              caption: mergedCaption,
              reply_markup: shouldAddKeyboardToMedia ? keyboard : undefined,
              parse_mode: 'HTML',
            },
          );
          sentMessageIds.push(sentMsg.message_id);
        } else {
          const sentMsg = await ctx.replyWithPhoto(
            new InputFile({ url: processedMediaUrl }),
            {
              caption: mergedCaption,
              reply_markup: shouldAddKeyboardToMedia ? keyboard : undefined,
              parse_mode: 'HTML',
            },
          );
          sentMessageIds.push(sentMsg.message_id);
        }
      } else {
        // 多个媒体文件，使用sendMediaGroup，caption放在第一个媒体上
        const media = await Promise.all(
          groupWelcome.medias.map(async (mediaUrl: string, idx: number) => {
            const processedMediaUrl = await generateLocalSignedUrl(mediaUrl);
            const mediaType = getMediaType(mediaUrl);

            return {
              type: mediaType as 'photo' | 'video',
              media: new InputFile({ url: processedMediaUrl }),
              ...(idx === 0
                ? { caption: mergedCaption, parse_mode: 'HTML' }
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

        // 如果有键盘，单独发送一条带键盘的提示消息
        if (keyboard) {
          const sentMsg = await ctx.reply('👆 欢迎查看上方内容', {
            reply_markup: keyboard,
          });
          sentMessageIds.push(sentMsg.message_id);
        }
      }
    } catch (error) {
      debug('Failed to send combined media and text:', error);
    }
  } else {
    // 只有文本或只有媒体的情况，按原有逻辑处理
    // 1. 发送所有的文本内容
    if (hasContents) {
      for (let i = 0; i < groupWelcome.contents.length; i++) {
        const content = groupWelcome.contents[i];
        const processedContent = replaceMessageVariables(content, variables);

        try {
          const sentMsg = await ctx.reply(processedContent, {
            reply_markup: keyboard,
            parse_mode: 'HTML',
          });
          sentMessageIds.push(sentMsg.message_id);
        } catch (error) {
          debug('Failed to send welcome content:', error);
        }
      }
    }

    // 2. 发送所有的媒体文件
    if (hasMedias) {
      try {
        if (groupWelcome.medias.length === 1) {
          const mediaUrl = groupWelcome.medias[0];
          const processedMediaUrl = await generateLocalSignedUrl(mediaUrl);
          const processedCaption = groupWelcome.caption
            ? replaceMessageVariables(groupWelcome.caption, variables)
            : undefined;
          const mediaType = getMediaType(mediaUrl);

          const shouldAddKeyboardToMedia =
            keyboard !== undefined && !hasContents;

          if (mediaType === 'video') {
            const sentMsg = await ctx.replyWithVideo(
              new InputFile({ url: processedMediaUrl }),
              {
                caption: processedCaption,
                reply_markup: shouldAddKeyboardToMedia ? keyboard : undefined,
                parse_mode: 'HTML',
              },
            );
            sentMessageIds.push(sentMsg.message_id);
          } else {
            const sentMsg = await ctx.replyWithPhoto(
              new InputFile({ url: processedMediaUrl }),
              {
                caption: processedCaption,
                reply_markup: shouldAddKeyboardToMedia ? keyboard : undefined,
                parse_mode: 'HTML',
              },
            );
            sentMessageIds.push(sentMsg.message_id);
          }
        } else {
          const processedCaption = groupWelcome.caption
            ? replaceMessageVariables(groupWelcome.caption, variables)
            : undefined;

          const media = await Promise.all(
            groupWelcome.medias.map(async (mediaUrl: string, idx: number) => {
              const processedMediaUrl = await generateLocalSignedUrl(mediaUrl);
              const mediaType = getMediaType(mediaUrl);

              return {
                type: mediaType as 'photo' | 'video',
                media: new InputFile({ url: processedMediaUrl }),
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

          if (keyboard && !hasContents) {
            const sentMsg = await ctx.reply('👆 欢迎查看上方内容', {
              reply_markup: keyboard,
            });
            sentMessageIds.push(sentMsg.message_id);
          }
        }
      } catch (error) {
        debug('Failed to send media group:', error);
        if (keyboard && !hasContents) {
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
  }

  // 3. 如果既没有内容也没有媒体，但有键盘，发送默认消息和键盘
  if (!hasContents && !hasMedias && keyboard) {
    const defaultMessage = `欢迎 ${username} 加入群组！👋`;
    const sentMsg = await ctx.reply(defaultMessage, { reply_markup: keyboard });
    sentMessageIds.push(sentMsg.message_id);
  }

  // 4. 阅后即焚：如果设置了删除时间，则在指定秒数后删除所有发送的消息
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
