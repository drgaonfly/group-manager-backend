import { Middleware } from 'grammy';
import { MyContext } from '../types';
import BotModel from '../../models/bot';
import Group from '../../models/group';
import Post from '../../models/post';
import createDebug from 'debug';

const debug = createDebug('bot:channelPostSaver');

/**
 * 监听 channel_post，将帖子实时写入 Post 表
 * 前提：bot 已被添加为该频道的管理员
 */
const channelPostSaver: Middleware<MyContext> = async (ctx, next) => {
  if (!ctx.channelPost) {
    await next();
    return;
  }

  const msg = ctx.channelPost;
  const text = msg.text || msg.caption;

  debug(`收到频道消息, chat_id: ${msg.chat.id}, msg_id: ${msg.message_id}`);
  console.log(
    `[channelPostSaver] chat_id: ${msg.chat.id}, msg_id: ${
      msg.message_id
    }, text: ${text?.slice(0, 50)}`,
  );

  if (!text) {
    await next();
    return;
  }

  try {
    const chatId = msg.chat.id;
    const token = ctx.me.is_bot ? ctx.api.token : '';

    const botDoc = await BotModel.findOne({ token });
    if (!botDoc?.post_source) {
      debug('bot 未配置 post_source，跳过');
      await next();
      return;
    }

    const group = await Group.findById(botDoc.post_source);
    debug(`post_source group: id=${group?.id}, chatId=${chatId}`);

    if (!group || group.id !== chatId) {
      debug('chatId 不匹配，跳过');
      await next();
      return;
    }

    const channelSlug = group.username || String(group.id);
    const link = `https://t.me/${channelSlug}/${msg.message_id}`;
    const title = text.split('\n')[0].trim().slice(0, 100) || '(无标题)';

    await Post.updateOne(
      { bot: botDoc._id, link },
      {
        $setOnInsert: {
          bot: botDoc._id,
          source: group._id,
          link,
          title,
          messageId: msg.message_id,
        },
      },
      { upsert: true },
    );

    console.log(`[channelPostSaver] 已保存帖子: "${title}" | ${link}`);
  } catch (err) {
    console.error('[channelPostSaver] 保存帖子失败:', err);
  }

  await next();
};

export default channelPostSaver;
