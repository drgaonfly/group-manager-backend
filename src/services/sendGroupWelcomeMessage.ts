import { InlineKeyboard, InputFile } from 'grammy';
import { MyContext } from '../bot/types';
import { generateLocalSignedUrl } from '../utils/generateSignedUrl';
import { getMediaType } from '../utils/mediaUtils';
import { replaceMessageVariables } from '../utils/telegramHtmlConvert';
import { formatBeijingDate } from '../utils/formatBeijingDate';
import createDebug from 'debug';

const debug = createDebug('bot:group-welcome');

interface GroupWelcomeConfig {
  contents?: string[];
  caption?: string;
  medias?: string[];
  menus?: {
    name: string;
    url: string;
  }[];
}

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
  groupWelcome?: GroupWelcomeConfig,
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

  // 1. 先发送所有的文本内容，一段一段发送，每个都带键盘
  if (groupWelcome.contents && groupWelcome.contents.length > 0) {
    for (let i = 0; i < groupWelcome.contents.length; i++) {
      const content = groupWelcome.contents[i];

      // 替换占位符
      const processedContent = replaceMessageVariables(content, variables);

      try {
        // 每个content都添加键盘
        await ctx.reply(processedContent, {
          reply_markup: keyboard,
          parse_mode: 'HTML',
        });
      } catch (error) {
        debug('Failed to send welcome content:', error);
      }
    }
  }

  // 2. 然后发送所有的媒体文件（作为媒体组）
  if (groupWelcome.medias && groupWelcome.medias.length > 0) {
    try {
      if (groupWelcome.medias.length === 1) {
        // 单个媒体文件，直接发送
        const mediaUrl = groupWelcome.medias[0];
        const processedMediaUrl = await generateLocalSignedUrl(mediaUrl);

        // 处理caption，替换占位符
        const processedCaption = groupWelcome.caption
          ? replaceMessageVariables(groupWelcome.caption, variables)
          : undefined;

        // 判断媒体类型
        const mediaType = getMediaType(mediaUrl);

        // 只有在没有发送过文本内容时才在媒体上添加键盘
        const shouldAddKeyboardToMedia =
          keyboard &&
          (!groupWelcome.contents || groupWelcome.contents.length === 0);

        if (mediaType === 'video') {
          await ctx.replyWithVideo(new InputFile({ url: processedMediaUrl }), {
            caption: processedCaption,
            reply_markup: shouldAddKeyboardToMedia ? keyboard : undefined,
            parse_mode: 'HTML',
          });
        } else {
          await ctx.replyWithPhoto(new InputFile({ url: processedMediaUrl }), {
            caption: processedCaption,
            reply_markup: shouldAddKeyboardToMedia ? keyboard : undefined,
            parse_mode: 'HTML',
          });
        }
      } else {
        // 处理caption，替换占位符
        const processedCaption = groupWelcome.caption
          ? replaceMessageVariables(groupWelcome.caption, variables)
          : undefined;

        // 多个媒体文件，使用 sendMediaGroup
        const media = await Promise.all(
          groupWelcome.medias.map(async (mediaUrl: string, idx: number) => {
            const processedMediaUrl = await generateLocalSignedUrl(mediaUrl);

            // 判断媒体类型
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

        // sendMediaGroup 不支持 reply_markup（内联菜单），Telegram API 限制
        await ctx.api.sendMediaGroup(ctx.chat!.id, media as any);

        // 如果有键盘且没有发送过文本内容，单独发送一条消息
        if (
          keyboard &&
          (!groupWelcome.contents || groupWelcome.contents.length === 0)
        ) {
          await ctx.reply('👆 欢迎查看上方内容', { reply_markup: keyboard });
        }
      }
    } catch (error) {
      debug('Failed to send media group:', error);
      // 如果媒体组发送失败，发送键盘回退
      if (keyboard) {
        try {
          await ctx.reply('📎 媒体文件发送失败', { reply_markup: keyboard });
        } catch (keyboardError) {
          debug('Failed to send keyboard fallback:', keyboardError);
        }
      }
    }
  }

  // 3. 如果既没有内容也没有媒体，但有键盘，发送默认消息和键盘
  if (
    (!groupWelcome.contents || groupWelcome.contents.length === 0) &&
    (!groupWelcome.medias || groupWelcome.medias.length === 0) &&
    keyboard
  ) {
    const defaultMessage = `欢迎 ${username} 加入群组！👋`;
    await ctx.reply(defaultMessage, { reply_markup: keyboard });
  }
};
