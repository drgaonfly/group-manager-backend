import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import Group from '../../../../models/group';
import BotUser from '../../../../models/botUser';
import createDebug from 'debug';

const debug = createDebug('bot:reload');

const reloadCommand = new Composer<MyContext>();

reloadCommand.command('reload', async (ctx) => {
  const chat = ctx.chat;

  if (chat.type === 'private') {
    debug('请群聊中使用此命令');
    return;
  }

  const chatId = chat.id;
  const chatTitle = (chat as any).title ?? '';
  const chatUsername = (chat as any).username ?? '';
  const chatType = chat.type;

  // 只用 id 判断，避免因 bot 字段不同而误判为新群组
  const existingGroup = await Group.findOne({
    id: chatId,
    bot: ctx.currentBot._id,
  });

  if (existingGroup) {
    await ctx.reply('目前正常，暂不需要重启');
    return;
  }

  // 用 upsert 避免与 botUserResolver 并发写入导致的 E11000
  const creatorBotUser = await BotUser.findOneAndUpdate(
    { id: ctx.from!.id.toString() },
    {
      $setOnInsert: {
        userName: ctx.from!.username || '',
        firstName: ctx.from!.first_name,
        lastName: ctx.from!.last_name || '',
        bot: ctx.currentBot._id,
        proxy: ctx.currentProxyUser?._id,
      },
    },
    { new: true, upsert: true },
  );

  debug(`✅ BotUser ready: ${ctx.from!.id}`);

  // 创建新群组记录，creator 为必填字段
  const newGroup = new Group({
    id: chatId,
    title: chatTitle,
    username: chatUsername,
    type: chatType,
    bot: ctx.currentBot._id,
    creator: creatorBotUser._id,
    proxy: ctx.currentProxyUser?._id,
  });

  await newGroup.save();

  // 将群组关联到 bot
  await ctx.currentBot.updateOne({
    $addToSet: {
      groups: newGroup._id,
    },
  });

  debug(`✅ /reload 重新创建群组记录: ${chatTitle} (${chatId})`);
  await ctx.reply('✅ 重启成功');
});

export default reloadCommand;
