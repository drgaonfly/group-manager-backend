import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import Post from '../../../../models/post';
import Group from '../../../../models/group';
import { ITEMS_PER_PAGE } from '../../../../constants';
import createDebug from 'debug';

const debug = createDebug('bot:post');

const postComposer = new Composer<MyContext>();

/**
 * 渲染帖子列表（新建/翻页共用）
 */
async function renderNewsList(
  ctx: MyContext,
  botId: any,
  sourceId: any,
  page: number,
  isEdit = false,
) {
  const total = await Post.countDocuments({ bot: botId, source: sourceId });
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE) || 1;

  const posts = await Post.find({ bot: botId, source: sourceId })
    .sort({ createdAt: 1 })
    .skip((page - 1) * ITEMS_PER_PAGE)
    .limit(ITEMS_PER_PAGE)
    .lean();

  if (posts.length === 0 && page === 1) {
    await ctx.reply('📭 暂无帖子信息。');
    return;
  }

  const lines = posts.map((p) => `• <a href="${p.link}">${p.title}</a>`);
  const header = `📰 <b>最新帖子</b>（第 ${page}/${totalPages} 页）\n\n`;
  const text = header + lines.join('\n');

  const keyboard = new InlineKeyboard();

  const navButtons = [];
  if (page > 1) {
    navButtons.push(InlineKeyboard.text('⬅️ 上一页', `news_page_${page - 1}`));
  }
  if (page < totalPages) {
    navButtons.push(InlineKeyboard.text('下一页 ➡️', `news_page_${page + 1}`));
  }
  if (navButtons.length > 0) {
    keyboard.row(...navButtons);
  }

  const options = {
    parse_mode: 'HTML' as const,
    link_preview_options: { is_disabled: true },
    reply_markup: keyboard,
  };

  if (isEdit) {
    await ctx.editMessageText(text, options);
  } else {
    await ctx.reply(text, options);
  }
}

// /news 命令入口
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

  const source = await Group.findById(bot.post_source);
  if (!source) {
    await ctx.reply('📭 新闻源频道不存在。');
    return;
  }

  await renderNewsList(ctx, bot._id, source._id, 1, false);
});

// 翻页回调
postComposer.callbackQuery(/^news_page_(\d+)$/, async (ctx) => {
  debug('news_page 回调触发');
  await ctx.answerCallbackQuery();

  const page = parseInt(ctx.match[1], 10);
  const bot = ctx.currentBot;
  if (!bot?.post_source) return;

  const source = await Group.findById(bot.post_source);
  if (!source) return;

  await renderNewsList(ctx, bot._id, source._id, page, true);
});

export default postComposer;
