import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../../../types';
import { checkTeaching } from '../../../middlewares/checkTeaching';
import BotUserConfig from '../../../../models/botUserConfig';
import Teacher from '../../../../models/teacher';
import mongoose from 'mongoose';
import createDebug from 'debug';

const debug = createDebug('bot:teaching:nearbyTeacher');
const nearbyTeacherComposer = new Composer<MyContext>();

const ITEMS_PER_PAGE = 10;
const DEFAULT_RADIUS_METERS = 500000; // 500 公里（可按业务需要调整）

async function getNearbyTeachersPage(
  botId: any,
  lng: number,
  lat: number,
  page: number,
  excludeBotUserId?: any, // 排除的用户ID（通常是查询者自己）
  botUserName?: string, // 机器人 username，用于生成"更新位置"链接
) {
  // 1. 拿该 bot 下所有 approved 老师的 botUser IDs
  const botObjectId = new mongoose.Types.ObjectId(botId.toString());

  const query: any = {
    bot: botObjectId,
    status: 'approved',
  };

  // 排除查询者自己（如果是老师的话）
  if (excludeBotUserId) {
    query.botUser = { $ne: excludeBotUserId };
  }

  const approvedTeachers = await Teacher.find(query).select('botUser');

  console.log(`[nearby] approved teachers count: ${approvedTeachers.length}`);

  if (approvedTeachers.length === 0) {
    const keyboard = new InlineKeyboard();
    if (botUserName) {
      keyboard.url(
        '📍 更新我的位置',
        `https://t.me/${botUserName}?start=update_location`,
      );
    }
    return { text: '暂无认证老师', keyboard, total: 0 };
  }

  const botUserIds = approvedTeachers.map((t) => t.botUser);

  // 2. 先查这批 botUser 在 BotUserConfig 里有没有坐标（不用 geoNear，先诊断）
  const configsWithLocation = await BotUserConfig.find({
    bot: botObjectId,
    botUser: { $in: botUserIds },
    location: { $exists: true },
  }).select('botUser location');

  console.log(
    `[nearby] teacher configs with location count: ${configsWithLocation.length}`,
  );
  configsWithLocation.forEach((c) => {
    console.log(
      `[nearby]   botUser=${c.botUser}, coords=${JSON.stringify(
        c.location?.coordinates,
      )}`,
    );
  });

  // 3. $geoNear 查询
  console.log(
    `[nearby] geoNear query: bot=${botId}, lng=${lng}, lat=${lat}, radius=${DEFAULT_RADIUS_METERS}m`,
  );
  console.log(
    `[nearby] botUserIds for geoNear:`,
    botUserIds.map((id) => id?.toString()),
  );

  let results: any[] = [];
  try {
    results = await BotUserConfig.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'dist.calculated',
          maxDistance: DEFAULT_RADIUS_METERS,
          spherical: true,
          query: {
            bot: botObjectId,
            botUser: { $in: botUserIds },
            location: { $exists: true },
          },
        },
      },
      { $sort: { 'dist.calculated': 1 } },
    ]);
    console.log(`[nearby] geoNear results count: ${results.length}`);
    results.forEach((r) => {
      console.log(
        `[nearby]   botUser=${r.botUser}, dist=${r.dist
          ?.calculated}m, coords=${JSON.stringify(r.location?.coordinates)}`,
      );
    });
  } catch (err) {
    console.error('[nearby] geoNear error:', err);
    return { text: '查询失败，请稍后重试', keyboard: null, total: 0 };
  }

  const total = results.length;
  if (total === 0) {
    const keyboard = new InlineKeyboard();
    if (botUserName) {
      keyboard.url(
        '📍 更新我的位置',
        `https://t.me/${botUserName}?start=update_location`,
      );
    }
    return {
      text: `📍 ${DEFAULT_RADIUS_METERS / 1000} 公里内暂无老师`,
      keyboard,
      total: 0,
    };
  }

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE) || 1;
  const paged = results.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  const lines = await Promise.all(
    paged.map(async (config: any) => {
      const distKm = (config.dist.calculated / 1000).toFixed(2);

      // 实时查询完整的老师信息
      const teacher = await Teacher.findOne({
        bot: botObjectId,
        botUser: config.botUser,
        status: 'approved',
      }).select('isAvailable display_name address');

      const statusIcon = teacher?.isAvailable ? '✅' : '🚫';
      const name = teacher?.display_name || '老师';
      // const area = teacher?.address || '';
      return `${statusIcon} ${name}（${distKm}公里）`;
    }),
  );

  const text = [
    `为您找到 <b>${total}</b> 位附近的老师：`,
    `状态说明：✅ 可约  🚫 休息中`,
    '',
    ...lines,
  ].join('\n');

  const keyboard = new InlineKeyboard();
  if (totalPages > 1) {
    if (page > 1)
      keyboard.text('⬅️ 上一页', `nearby_page:${page - 1}:${lng}:${lat}`);
    if (page < totalPages)
      keyboard.text('➡️ 下一页', `nearby_page:${page + 1}:${lng}:${lat}`);
    keyboard.row();
  }
  if (botUserName) {
    keyboard.url(
      '📍 更新我的位置',
      `https://t.me/${botUserName}?start=update_location`,
    );
  }

  return { text, keyboard, total, totalPages };
}

// ── 群里发「附近」触发 ────────────────────────────────────────────────────────
nearbyTeacherComposer.hears('附近', checkTeaching, async (ctx) => {
  const botUser = ctx.currentBotUser;
  console.log(
    `[nearby] triggered by botUser: ${botUser?._id}, telegramId: ${botUser?.id}`,
  );
  console.log(`[nearby] bot: ${ctx.currentBot?._id}`);

  if (!botUser) {
    console.log('[nearby] no botUser found');
    return;
  }

  // 读取发消息用户的位置
  const config = await BotUserConfig.findOne({
    bot: ctx.currentBot!._id,
    botUser: botUser._id,
  }).select('location');

  console.log(`[nearby] user config found: ${!!config}`);
  console.log(`[nearby] user location: ${JSON.stringify(config?.location)}`);

  if (!config?.location?.coordinates) {
    const botUserName = ctx.me.username;
    const keyboard = new InlineKeyboard();
    if (botUserName) {
      keyboard.url(
        '📍 去私聊更新我的位置',
        `https://t.me/${botUserName}?start=update_location`,
      );
    }
    await ctx.reply(
      '您还没有设置位置。\n请先私聊机器人发送「更新位置」，设置后即可在群里查找附近老师。',
      { reply_markup: keyboard },
    );
    return;
  }

  const [lng, lat] = config.location.coordinates;
  console.log(`[nearby] user coords: lng=${lng}, lat=${lat}`);

  const { text, keyboard, total } = await getNearbyTeachersPage(
    ctx.currentBot!._id,
    lng,
    lat,
    1,
    botUser._id, // 传入当前用户ID，用于排除自己
    ctx.me.username, // 传入机器人 username，用于"更新位置"按钮
  );

  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: keyboard ?? undefined,
  });
});

// ── 分页回调 ─────────────────────────────────────────────────────────────────
nearbyTeacherComposer.callbackQuery(
  /^nearby_page:(\d+):([-\d.]+):([-\d.]+)$/,
  async (ctx) => {
    const page = parseInt(ctx.match[1]);
    const lng = parseFloat(ctx.match[2]);
    const lat = parseFloat(ctx.match[3]);

    const { text, keyboard } = await getNearbyTeachersPage(
      ctx.currentBot!._id,
      lng,
      lat,
      page,
      ctx.currentBotUser?._id, // 分页时也排除自己
      ctx.me.username, // 分页时也带上"更新位置"按钮
    );

    try {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: keyboard ?? undefined,
      });
    } catch (e) {
      debug('edit message failed: %o', e);
    }
    await ctx.answerCallbackQuery();
  },
);

export default nearbyTeacherComposer;
