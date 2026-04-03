import { Composer, InlineKeyboard } from 'grammy';
import { createConversation, Conversation } from '@grammyjs/conversations';
import { MyContext } from '../../../types';
import { checkInBot } from '../../../middlewares/checkInBot';
import { checkTeaching } from '../../../middlewares/checkTeaching';
import Teacher from '../../../../models/teacher';
import { IBot } from '../../../../models/bot';
import BotUser, { IBotUser } from '../../../../models/botUser';
import Evaluation from '../../../../models/evaluation';
import { downloadTelegramFile } from '../../../services/dowlnloader';
import createDebug from 'debug';

const debug = createDebug('bot:teaching:writeReview');
const writeReviewComposer = new Composer<MyContext>();

const TIMEOUT = 10 * 60 * 1000;

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const ratingFields = [
  { key: 'avatar_rating', label: '人照评分', icon: '📷' },
  { key: 'appearance_rating', label: '颜值评分', icon: '💃' },
  { key: 'body_rating', label: '身材评分', icon: '👙' },
  { key: 'service_rating', label: '服务评分', icon: '✨' },
  { key: 'attitude_rating', label: '态度评分', icon: '🥰' },
  { key: 'circumstance_rating', label: '环境评分', icon: '🏠' },
];

async function writeRiviewOtherTeacherConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
  {
    bot,
    botUser,
  }: {
    bot: IBot;
    botUser: IBotUser;
  },
) {
  await ctx.reply(
    '请问你要给哪位老师写车评？\n请在下方输入框输入老师的名字或用户名。\n如果不写车评，请点击关闭。',
    {
      reply_markup: new InlineKeyboard().text('❌ 关闭', 'close'),
    },
  );

  const result = await conversation.waitFor(
    ['message:text', 'callback_query:data'],
    {
      maxMilliseconds: TIMEOUT,
    },
  );

  if (result.callbackQuery?.data === 'close') {
    await ctx.deleteMessage();
    await ctx.reply('❌ 已取消操作');
    return;
  }

  const teacherNameRaw = result.message?.text?.trim() || '';
  if (!teacherNameRaw) {
    await ctx.reply('请输入有效的老师名字');
    return writeRiviewOtherTeacherConversation(conversation, ctx, {
      bot,
      botUser,
    });
  }

  const teacherKey = teacherNameRaw.replace(/^@/, '');
  const safe = escapeRegExp(teacherKey);
  const regex = new RegExp(safe, 'i');

  // 同时搜索 BotUser 和 Teacher 的 display_name
  const candidatesBotUsers = await BotUser.find({
    $or: [{ userName: regex }, { firstName: regex }, { lastName: regex }],
  })
    .select('_id userName firstName lastName')
    .limit(20);

  const botUserIds = candidatesBotUsers.map((u) => u._id);

  const teachers = await Teacher.find({
    bot: bot!._id,
    $or: [{ botUser: { $in: botUserIds } }, { display_name: regex }],
    status: 'approved',
  })
    .populate('botUser')
    .limit(10);

  if (teachers.length === 0) {
    await ctx.reply('未找到匹配的认证老师');
    return;
  }

  const selectable = teachers.filter(
    (t: any) => t.botUser?._id?.toString?.() !== botUser._id.toString(),
  );

  if (selectable.length === 0) {
    await ctx.reply('不能给自己写评论');
    return;
  }

  let selectedTeacher: any = null;
  if (selectable.length === 1) {
    selectedTeacher = selectable[0];
  } else {
    const keyboard = new InlineKeyboard();
    const listLines = selectable.map((t: any, i: number) => {
      const u = t.botUser;
      const name =
        t.display_name ||
        (u?.userName
          ? `@${u.userName}`
          : `${u?.firstName || ''} ${u?.lastName || ''}`.trim() || '未知用户');
      keyboard.text(`${i + 1}`, `teach_review_select:${t._id.toString()}`);
      if ((i + 1) % 5 === 0) keyboard.row();
      return `${i + 1}. ${name} \n${t.contactLink}`;
    });

    keyboard.row().text('❌ 取消', 'close');

    await ctx.reply(['匹配到多个老师，请选择：', '', ...listLines].join('\n'), {
      reply_markup: keyboard,
    });

    const pick = await conversation.waitFor(['callback_query:data'], {
      maxMilliseconds: TIMEOUT,
    });

    const data = pick.callbackQuery?.data;
    if (data === 'close') {
      await ctx.reply('❌ 已取消');
      return;
    }

    const m = data?.match(/^teach_review_select:(.+)$/);
    if (!m) {
      await ctx.reply('选择无效，请重试');
      return;
    }

    selectedTeacher = selectable.find((t: any) => t._id.toString() === m[1]);
  }

  if (!selectedTeacher) {
    await ctx.reply('未找到选中的老师');
    return;
  }

  // 开始评价交互界面
  const ratings: any = {
    avatar_rating: 0,
    appearance_rating: 0,
    body_rating: 0,
    service_rating: 0,
    attitude_rating: 0,
    circumstance_rating: 0,
  };
  let process_desc = '';
  const proof_media: string[] = [];
  let isReportedAnoymously = false;

  const getMenuKeyboard = () => {
    const kb = new InlineKeyboard();

    // 评分按钮 (2列)
    ratingFields.forEach((f, i) => {
      const currentVal = ratings[f.key] ? ratings[f.key] * 2 : '';
      kb.text(
        `${f.icon} ${f.label}${currentVal ? ` (${currentVal}分)` : ''}`,
        `set_rating:${f.key}`,
      );
      if (i % 2 === 1) kb.row();
    });

    if (ratingFields.length % 2 !== 0) kb.row();

    // 过程描述按钮
    kb.text(`📝 过程描述${process_desc ? ' (已填写)' : ''}`, 'set_desc').row();

    // 媒体上传按钮
    kb.text(
      `📸 上传出击图片/视频${
        proof_media.length ? ` (${proof_media.length})` : ''
      }`,
      'upload_media',
    ).row();

    // 匿名和提交
    kb.text(
      isReportedAnoymously ? '✅ 匿名提交' : '⬜ 匿名提交',
      'toggle_anon',
    );
    kb.text('✅ 提交', 'submit_final').row();

    kb.text('↩️ 返回', 'close');

    return kb;
  };

  const getMenuText = () => {
    let text = `请选择下面的按钮进行评价，也可以复制以下模板补充内容发送发送给我，请不要改动括号里面的内容：\n\n`;
    text += `【人照评分】：${
      ratings.avatar_rating ? ratings.avatar_rating * 2 : ''
    }\n`;
    text += `【颜值评分】：${
      ratings.appearance_rating ? ratings.appearance_rating * 2 : ''
    }\n`;
    text += `【身材评分】：${
      ratings.body_rating ? ratings.body_rating * 2 : ''
    }\n`;
    text += `【服务评分】：${
      ratings.service_rating ? ratings.service_rating * 2 : ''
    }\n`;
    text += `【态度评分】：${
      ratings.attitude_rating ? ratings.attitude_rating * 2 : ''
    }\n`;
    text += `【环境评分】：${
      ratings.circumstance_rating ? ratings.circumstance_rating * 2 : ''
    }\n`;
    text += `【过程描述】：${process_desc}\n`;

    return text;
  };

  let menuMsg = await ctx.reply(getMenuText(), {
    reply_markup: getMenuKeyboard(),
  });

  let isRunning = true;
  while (isRunning) {
    const interaction = await conversation.waitFor(
      ['callback_query:data', 'message:text', 'message:photo', 'message:video'],
      {
        maxMilliseconds: TIMEOUT,
      },
    );

    if (interaction.callbackQuery) {
      const data = interaction.callbackQuery.data;
      try {
        await ctx.api.answerCallbackQuery(interaction.callbackQuery.id);
      } catch (e) {
        debug('Error answering callback query:', e);
      }

      if (data === 'close') {
        await ctx.reply('❌ 已取消');
        isRunning = false;
        break;
      }

      if (data.startsWith('set_rating:')) {
        const key = data.split(':')[1];
        const field = ratingFields.find((f) => f.key === key);
        await ctx.api.editMessageText(
          ctx.chat!.id,
          menuMsg.message_id,
          `请输入${field?.label} (0-10分):`,
          {
            reply_markup: new InlineKeyboard().text('取消', 'cancel_input'),
          },
        );

        const input = await conversation.waitFor(
          ['message:text', 'callback_query:data'],
          { maxMilliseconds: 60000 },
        );

        if (input.message?.text) {
          const val = parseInt(input.message.text);
          try {
            await ctx.api.deleteMessage(ctx.chat!.id, input.message.message_id);
          } catch (e) {
            debug('Delete input message failed:', e);
          }
          if (!isNaN(val) && val >= 0 && val <= 10) {
            ratings[key] = val / 2;
          } else {
            const errorMsg = await ctx.reply(
              '评分无效，请输入 0-10 之间的数字',
            );
            setTimeout(
              () =>
                ctx.api
                  .deleteMessage(ctx.chat!.id, errorMsg.message_id)
                  .catch((err) => debug('Delete error msg failed', err)),
              3000,
            );
          }
        }
      } else if (data === 'set_desc') {
        await ctx.api.editMessageText(
          ctx.chat!.id,
          menuMsg.message_id,
          '请输入过程描述：',
          {
            reply_markup: new InlineKeyboard().text('取消', 'cancel_input'),
          },
        );
        const input = await conversation.waitFor(
          ['message:text', 'callback_query:data'],
          { maxMilliseconds: 120000 },
        );
        if (input.message?.text) {
          process_desc = input.message.text;
          try {
            await ctx.api.deleteMessage(ctx.chat!.id, input.message.message_id);
          } catch (e) {
            debug('Delete desc input failed:', e);
          }
        }
      } else if (data === 'upload_media') {
        await ctx.api.editMessageText(
          ctx.chat!.id,
          menuMsg.message_id,
          '请发送图片或视频，完成后点击下方按钮：',
          {
            reply_markup: new InlineKeyboard().text(
              '✅ 完成上传',
              'done_media',
            ),
          },
        );

        let isUploading = true;
        while (isUploading) {
          const media = await conversation.waitFor(
            ['message:photo', 'message:video', 'callback_query:data'],
            { maxMilliseconds: 300000 },
          );
          if (media.callbackQuery?.data === 'done_media') {
            isUploading = false;
            break;
          }

          const botToken = ctx.api.token;
          if (media.message?.photo) {
            const photo = media.message.photo[media.message.photo.length - 1];
            const fileName = await downloadTelegramFile(
              botToken,
              photo.file_id,
            );
            if (fileName) {
              proof_media.push(fileName);
              try {
                await ctx.api.deleteMessage(
                  ctx.chat!.id,
                  media.message.message_id,
                );
              } catch (e) {
                debug('Delete photo failed:', e);
              }
              await ctx.reply(`已收到图片 (${proof_media.length})`, {
                reply_markup: new InlineKeyboard().text(
                  '✅ 完成上传',
                  'done_media',
                ),
              });
            }
          } else if (media.message?.video) {
            const video = media.message.video;
            const fileName = await downloadTelegramFile(
              botToken,
              video.file_id,
            );
            if (fileName) {
              proof_media.push(fileName);
              try {
                await ctx.api.deleteMessage(
                  ctx.chat!.id,
                  media.message.message_id,
                );
              } catch (e) {
                debug('Delete video failed:', e);
              }
              await ctx.reply(`已收到视频 (${proof_media.length})`, {
                reply_markup: new InlineKeyboard().text(
                  '✅ 完成上传',
                  'done_media',
                ),
              });
            }
          }
        }
      } else if (data === 'toggle_anon') {
        isReportedAnoymously = !isReportedAnoymously;
      } else if (data === 'submit_final') {
        // 简单校验
        const hasRatings = Object.values(ratings).some((v) => v !== 0);
        if (!hasRatings || !process_desc) {
          const errorMsg =
            await ctx.reply('❌ 请至少填写评分和过程描述后再提交');
          setTimeout(
            () =>
              ctx.api
                .deleteMessage(ctx.chat!.id, errorMsg.message_id)
                .catch((err) => debug('Delete error msg failed', err)),
            3000,
          );
          continue;
        }

        await Evaluation.create({
          bot: bot._id,
          reviewer: botUser._id,
          teacher: selectedTeacher._id,
          ...ratings,
          process_desc,
          proof_media,
          isReportedAnoymously,
          status: 'pending',
        });

        await ctx.api.editMessageText(
          ctx.chat!.id,
          menuMsg.message_id,
          '✅ 评价已提交，请等待管理员审核。',
        );
        isRunning = false;
        break;
      }

      // 刷新菜单 (如果还没有提交)
      if (data !== 'submit_final') {
        try {
          await ctx.api.editMessageText(
            ctx.chat!.id,
            menuMsg.message_id,
            getMenuText(),
            { reply_markup: getMenuKeyboard() },
          );
        } catch (e) {
          // 如果编辑失败（比如内容没变），则重新发送
          menuMsg = await ctx.reply(getMenuText(), {
            reply_markup: getMenuKeyboard(),
          });
        }
      }
    } else if (interaction.message?.text) {
      // 模板解析逻辑
      const text = interaction.message.text;
      const templateMatch = text.includes('【人照评分】');

      if (templateMatch) {
        try {
          await ctx.api.deleteMessage(
            ctx.chat!.id,
            interaction.message.message_id,
          );
        } catch (e) {
          debug('Delete template message failed:', e);
        }
        const getVal = (label: string) => {
          const regex = new RegExp(`【${label}】：\\s*(\\d+)`);
          const m = text.match(regex);
          return m ? parseInt(m[1]) : null;
        };

        const avatar = getVal('人照评分');
        const appearance = getVal('颜值评分');
        const body = getVal('身材评分');
        const service = getVal('服务评分');
        const attitude = getVal('态度评分');
        const circumstance = getVal('环境评分');

        const descMatch = text.match(/【过程描述】：\s*([\s\S]+)/);

        if (avatar !== null) ratings.avatar_rating = avatar / 2;
        if (appearance !== null) ratings.appearance_rating = appearance / 2;
        if (body !== null) ratings.body_rating = body / 2;
        if (service !== null) ratings.service_rating = service / 2;
        if (attitude !== null) ratings.attitude_rating = attitude / 2;
        if (circumstance !== null)
          ratings.circumstance_rating = circumstance / 2;
        if (descMatch) process_desc = descMatch[1].trim();

        await ctx.reply('✅ 已根据模板更新评价内容');

        // 尝试更新菜单消息，如果失败则重新发送
        try {
          await ctx.api.editMessageText(
            ctx.chat!.id,
            menuMsg.message_id,
            getMenuText(),
            { reply_markup: getMenuKeyboard() },
          );
        } catch (e) {
          menuMsg = await ctx.reply(getMenuText(), {
            reply_markup: getMenuKeyboard(),
          });
        }
      }
    }
  }
}

writeReviewComposer.use(
  createConversation(writeRiviewOtherTeacherConversation),
);

writeReviewComposer.hears(/写车评/, checkInBot, checkTeaching, async (ctx) => {
  await ctx.conversation.exitAll();

  await ctx.conversation.enter('writeRiviewOtherTeacherConversation', {
    bot: ctx.currentBot,
    botUser: ctx.currentBotUser,
  });
});

export default writeReviewComposer;
