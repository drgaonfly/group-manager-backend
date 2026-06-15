import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import Group from '../../../../models/group';
import BotUser from '../../../../models/botUser';
import createDebug from 'debug';

const debug = createDebug('bot:reload');

const reloadCommand = new Composer<MyContext>();

reloadCommand.command('reload', async (ctx) => {
  const chat = ctx.chat;

  const chatId = chat.id;
  const chatTitle = (chat as any).title ?? '';
  const chatUsername = (chat as any).username ?? '';
  const chatType = chat.type;

  if (!chatId) {
    await ctx.reply('该命令仅在群组使用');
  }

  // 检查群组记录是否已存在
  const existingGroup = await Group.findOne({
    id: chatId,
    bot: ctx.currentBot._id,
  });

  if (existingGroup) {
    await ctx.reply('目前正常，暂不需要重启');
    return;
  }

  // 查找操作者的 BotUser 记录，用作 creator
  let creatorBotUser = await BotUser.findOne({
    id: ctx.from!.id.toString(),
    proxy: ctx.currentProxyUser._id,
  });

  if (!creatorBotUser) {
    // 自动创建 BotUser
    creatorBotUser = new BotUser({
      id: ctx.from!.id.toString(),
      userName: ctx.from!.username || '',
      firstName: ctx.from!.first_name,
      lastName: ctx.from!.last_name || '',
      bot: ctx.currentBot._id,
      proxy: ctx.currentProxyUser._id,
    });
    await creatorBotUser.save();
    debug(`✅ 创建新 BotUser: ${ctx.from!.id}`);
  }

  // 创建新群组记录
  const newGroup = new Group({
    id: chatId,
    title: chatTitle,
    username: chatUsername,
    type: chatType,
    bot: ctx.currentBot._id,
    proxy: ctx.currentProxyUser._id,
  });

  await newGroup.save();

  // 将群组关联到 bot
  await ctx.currentBot.updateOne({
    $addToSet: {
      groups: newGroup._id,
    },
  });

  debug(`✅ /reload 重新创建群组记录: ${chatTitle} (${chatId})`);
  await ctx.reply('重启成功');
});

export default reloadCommand;
