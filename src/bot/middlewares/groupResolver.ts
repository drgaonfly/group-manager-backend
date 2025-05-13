import { Middleware } from 'grammy';
import Group from '../../models/group';
import { MyContext } from '../types';
import createDebug from 'debug';

const debug = createDebug('bot:group');

const groupResolver: Middleware<MyContext> = async (ctx, next) => {
  // 检查是否在群组中
  if (!ctx.chat || ctx.chat.type === 'private') {
    debug('请在群组中使用此命令');
    ctx.currentGroup = null;
    return await next();
  }

  const chatId = ctx.chat.id;

  // 查询数据库中的群组信息
  const currentGroup = await Group.findOne({
    id: chatId,
  }).populate(['bot', 'creator', 'operators']);

  // 打印群组信息
  debug('Group info:', {
    id: ctx.chat.id,
    title: ctx.chat.title,
    type: ctx.chat.type,
  });

  if (!currentGroup) {
    // 如果群组不存在，创建新群组记录
    const newGroup = new Group({
      id: chatId,
      title: ctx.chat.title,
      type: ctx.chat.type,
      bot: ctx.currentBot._id, // 假设botResolver中间件已经运行并设置了currentBot
      creator: ctx.currentBotUser._id, // 假设已有用户记录
      exchange_rate: 1,
      fee_rate: 0,
    });

    await newGroup.save();
    ctx.currentGroup = newGroup;

    await ctx.reply('感谢您把我添加到贵群!\n下一步设置费率，请发：设置费率x%');
  } else {
    // 更新群组信息
    // 只在群组标题或类型发生变化时才更新
    if (
      currentGroup.title !== ctx.chat.title ||
      currentGroup.type !== ctx.chat.type
    ) {
      currentGroup.title = ctx.chat.title;
      currentGroup.type = ctx.chat.type;
      await currentGroup.save();
    }

    ctx.currentGroup = currentGroup;
  }

  // 使用 $addToSet 将当前用户添加到群组的用户列表中，避免重复添加
  await Group.updateOne(
    { _id: ctx.currentGroup._id },
    {
      $addToSet: {
        botUsers: ctx.currentBotUser._id,
      },
    },
  );
  debug('Added user to group botUsers:', ctx.currentBotUser._id);

  // 继续处理后续中间件
  await next();
};

export default groupResolver;
