import { Middleware } from 'grammy';
import BotUserConfig from '../../models/botUserConfig';
import { MyContext } from '../types';
import { generateInviteCode } from '../../utils/generateInviteCode';
import Group from '../../models/group';

const botUserConfigResolver: Middleware<MyContext> = async (ctx, next) => {
  if (!ctx.currentBot) {
    await ctx.reply('请先初始化机器人');
    return;
  }

  if (!ctx.currentBotUser) {
    await ctx.reply('请先初始化用户');
    return;
  }

  // 检查是否是 /start 命令，并尝试从 payload 中提取邀请码和群组ID
  let inviteCodeFromStart: string | undefined;
  let groupIdFromInvite: string | undefined;

  if (ctx.message?.text?.startsWith('/start')) {
    const payload = ctx.message.text.split(' ')[1];

    if (payload) {
      // 期望格式为 aPMsv_-4636672521
      const [code, groupId] = payload.split('_');
      inviteCodeFromStart = code;
      groupIdFromInvite = groupId;
    }
  }

  console.log(
    'inviteCodeFromStart',
    inviteCodeFromStart,
    'groupIdFromInvite',
    groupIdFromInvite,
  );

  // 查找或创建用户配置
  const botUserConfig = await BotUserConfig.findOneAndUpdate(
    {
      botUser: ctx.currentBotUser._id,
      bot: ctx.currentBot._id,
    },
    {
      $setOnInsert: {
        botUser: ctx.currentBotUser._id,
        bot: ctx.currentBot._id,
      },
    },
    { new: true, upsert: true },
  );

  let parent = null;
  // 只有在用户是新用户且通过邀请链接进入时，才查找 parent
  if (!botUserConfig.parent && inviteCodeFromStart) {
    parent = await BotUserConfig.findOne({
      spread_code: inviteCodeFromStart,
    });
  }

  if (parent) {
    if (parent.botUser.toString() === ctx.currentBotUser._id.toString()) {
      console.log('[botUserConfigResolver] 用户试图邀请自己，操作被阻止');
      return;
    } else {
      botUserConfig.parent = parent._id; // 将 parent 赋值为 parent 的 _id
      await botUserConfig.save();

      await BotUserConfig.findByIdAndUpdate(parent._id, {
        $inc: { invited_counts: 1 },
      });
    }
  }

  if (!botUserConfig.spread_code) {
    botUserConfig.spread_code = await generateInviteCode();
    await botUserConfig.save();
  }

  if (!botUserConfig.invited_group) {
    if (groupIdFromInvite) {
      const group = await Group.findOne({ id: groupIdFromInvite });
      if (group) {
        botUserConfig.invited_group = group._id;

        await botUserConfig.save();
      }
    } else {
      botUserConfig.invited_group = null;

      await botUserConfig.save();
    }
  }

  ctx.currentBotUserConfig = botUserConfig;

  await next();
};

export default botUserConfigResolver;
