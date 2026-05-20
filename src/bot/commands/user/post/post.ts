import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import Post from '../../../../models/post';
import Group from '../../../../models/group';
import createDebug from 'debug';

const debug = createDebug('bot:post');

const postComposer = new Composer<MyContext>();

postComposer.command('news', async (ctx) => {
  debug('/news 命令触发');

  const bot = ctx.currentBot;
  if (!bot) {
    await ctx.reply('❌ 机器人信息获取失败，请稍后再试。');
    return;
  }

  if (!bot.post_source) {
    await ctx.reply('📭 该机器人未配置新闻源频道。');
    return;
  }

  // post_source 可能已 populate 为 IGroup，也可能只是 ObjectId
  const source = await Group.findById(bot.post_source);

  const posts = await Post.find({ bot: bot._id, source: source._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  if (!posts || posts.length === 0) {
    await ctx.reply('📭 暂无帖子信息。');
    return;
  }

  const lines = posts.map((p) => `• <a href="${p.link}">${p.title}</a>`);
  const text = `📰 <b>最新帖子</b>\n\n${lines.join('\n')}`;

  await ctx.reply(text, {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  });
});

export default postComposer;
