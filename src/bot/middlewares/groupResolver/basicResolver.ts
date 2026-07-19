import { Middleware } from 'grammy';
import { MyContext } from '../../types';
import { findBotProxy } from '../../services/findBotProxy';
import Group from '../../../models/group';
import createDebug from 'debug';

const debug = createDebug('bot:group:basic');

/**
 * 基础群组信息解析中间件
 * 职责：
 * 1. 检查是否在群组/频道中
 * 2. 查询或创建群组记录
 * 3. 更新群组基本信息（title, type, username）
 * 4. 将 currentGroup 挂载到 ctx
 */
export const basicResolver: Middleware<MyContext> = async (ctx, next) => {
  const chat = ctx.chat || ctx.myChatMember?.chat || ctx.chatMember?.chat;

  // 仅处理群组和频道
  if (!chat || chat.type === 'private') {
    ctx.currentGroup = null;
    return await next();
  }

  const chatId = chat.id;
  const chatTitle = (chat as any).title;
  const chatType = chat.type;
  const chatUsername = (chat as any).username ?? '';

  const { proxyUser } = await findBotProxy(ctx.currentBot);

  // 查询数据库中的群组信息
  let currentGroup = await Group.findOne({
    id: chatId,
    proxy: proxyUser._id,
  }).populate(['bot', 'creator', 'operators']);

  // 如果找到群组，更新基本信息
  if (currentGroup) {
    const groupUsername = currentGroup.username ?? '';
    if (
      currentGroup.title !== chatTitle ||
      currentGroup.type !== chatType ||
      groupUsername !== chatUsername
    ) {
      currentGroup.title = chatTitle;
      currentGroup.type = chatType;
      currentGroup.username = chatUsername;
      await currentGroup.save();
    }
    ctx.currentGroup = currentGroup;
  } else {
    // 群组不存在，留给后续中间件处理创建
    ctx.currentGroup = null;
  }

  debug('Group info:', {
    id: chatId,
    title: chatTitle,
    type: chatType,
    found: !!currentGroup,
  });

  await next();
};
