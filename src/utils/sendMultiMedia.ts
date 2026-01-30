import { Api, Context, InputFile } from 'grammy';
import { getMediaType } from './mediaUtils';

interface SendMediaOptions {
  caption?: string;
  parse_mode?: 'HTML' | 'Markdown';
  reply_markup?: any;
  reply_to_message_id?: number;
}

interface SendMediaResult {
  message_id?: number;
  media_group_messages?: any[];
}

/**
 * 统一的媒体消息发送工具函数
 * @param api Telegram API 实例 (telegramBot.api 或 ctx.api)
 * @param chatId 聊天ID
 * @param medias 媒体文件数组
 * @param options 发送选项
 * @param filePathPrefix 文件路径前缀，默认为 'tmp/' (用于本地文件)
 * @returns 发送结果
 */
export const sendMediaMessage = async (
  api: Api,
  chatId: string | number,
  medias: string[],
  options: SendMediaOptions = {},
  filePathPrefix: string = 'tmp/',
): Promise<SendMediaResult> => {
  if (!medias || !Array.isArray(medias) || medias.length === 0) {
    throw new Error('媒体文件不能为空');
  }

  const {
    caption,
    parse_mode = 'HTML',
    reply_markup,
    reply_to_message_id,
  } = options;

  // 构建基础选项
  const baseOptions: any = {
    parse_mode,
    ...(reply_to_message_id && { reply_to_message_id }),
  };

  if (medias.length === 1) {
    // 单个媒体文件
    const mediaPath = medias[0];
    const mediaType = getMediaType(mediaPath);
    const inputFile = new InputFile(`${filePathPrefix}${mediaPath}`);

    const sendOptions = {
      ...baseOptions,
      ...(caption && { caption }),
      ...(reply_markup && { reply_markup }),
    };

    if (mediaType === 'video') {
      const result = await api.sendVideo(chatId, inputFile, sendOptions);
      return { message_id: result.message_id };
    } else {
      const result = await api.sendPhoto(chatId, inputFile, sendOptions);
      return { message_id: result.message_id };
    }
  } else {
    // 多个媒体文件，使用 sendMediaGroup
    const hasInlineKeyboard = reply_markup !== undefined;

    const media = medias.map((file: string, index: number) => {
      const type = getMediaType(file);
      const mediaItem: any = {
        type: type as 'photo' | 'video',
        media: new InputFile(`${filePathPrefix}${file}`),
      };

      // 如果没有内联菜单，把 caption 放在第一个媒体上
      if (!hasInlineKeyboard && index === 0 && caption) {
        mediaItem.caption = caption;
        mediaItem.parse_mode = parse_mode;
      }

      return mediaItem;
    });

    const mediaGroupMessages = await api.sendMediaGroup(chatId, media as any);

    // 如果有内联菜单，需要单独发送文本消息
    if (hasInlineKeyboard && caption) {
      const textMessage = await api.sendMessage(chatId, caption, {
        parse_mode,
        reply_markup,
        ...(reply_to_message_id && { reply_to_message_id }),
      });

      return {
        media_group_messages: mediaGroupMessages,
        message_id: textMessage.message_id,
      };
    }

    return { media_group_messages: mediaGroupMessages };
  }
};

/**
 * 使用 Context API 的媒体发送工具函数 (用于中间件)
 * @param ctx Telegram Context
 * @param medias 媒体文件数组
 * @param options 发送选项
 * @returns 发送结果
 */
export const sendMediaMessageWithContext = async (
  ctx: Context,
  medias: string[],
  options: SendMediaOptions = {},
): Promise<SendMediaResult> => {
  if (!medias || !Array.isArray(medias) || medias.length === 0) {
    throw new Error('媒体文件不能为空');
  }

  const {
    caption,
    parse_mode = 'HTML',
    reply_markup,
    reply_to_message_id,
  } = options;

  if (medias.length === 1) {
    // 单个媒体文件
    const mediaPath = medias[0];
    const mediaType = getMediaType(mediaPath);
    const inputFile = new InputFile(`tmp/${mediaPath}`);

    const sendOptions = {
      ...(caption && { caption }),
      ...(parse_mode && { parse_mode }),
      ...(reply_markup && { reply_markup }),
      ...(reply_to_message_id && { reply_to_message_id }),
    };

    if (mediaType === 'video') {
      const result = await ctx.replyWithVideo(inputFile, sendOptions);
      return { message_id: result.message_id };
    } else {
      const result = await ctx.replyWithPhoto(inputFile, sendOptions);
      return { message_id: result.message_id };
    }
  } else {
    // 多个媒体文件，使用 sendMediaGroup
    const hasInlineKeyboard = reply_markup !== undefined;

    const media = medias.map((file: string, index: number) => {
      const type = getMediaType(file);
      const mediaItem: any = {
        type: type as 'photo' | 'video',
        media: new InputFile(`tmp/${file}`),
      };

      // 如果没有内联菜单，把 caption 放在第一个媒体上
      if (!hasInlineKeyboard && index === 0 && caption) {
        mediaItem.caption = caption;
        mediaItem.parse_mode = parse_mode;
      }

      return mediaItem;
    });

    const mediaGroupMessages = await ctx.api.sendMediaGroup(
      ctx.chat!.id,
      media as any,
    );

    // 如果有内联菜单，需要单独发送文本消息
    if (hasInlineKeyboard && caption) {
      const textMessage = await ctx.api.sendMessage(ctx.chat!.id, caption, {
        parse_mode,
        reply_markup,
        ...(reply_to_message_id && { reply_to_message_id }),
      });

      return {
        media_group_messages: mediaGroupMessages,
        message_id: textMessage.message_id,
      };
    }

    return { media_group_messages: mediaGroupMessages };
  }
};
