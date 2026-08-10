import { Middleware } from 'grammy';
import { MyContext } from '../types';
import ReplyRule from '../../models/replyRule';
import BotUser from '../../models/botUser';
import { replaceVariables, MemberInfo } from '../../utils/replaceVariables';
import { buildInlineKeyboard } from '../../utils/buildInlineKeyboard';
import {
  getGroupUserRanking,
  getGroupUserRankingList,
} from '../../services/rankingService';
import { ITEMS_PER_PAGE } from '../../constants';
import { sendMediaMessageWithContext } from '../../utils/sendMultiMedia';
import createDebug from 'debug';

const debug = createDebug('bot:replyRule');

// 波场地址正则表达式 (T开头，34个字符，Base58编码)
const TRON_ADDRESS_REGEX = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

// 检查消息是否包含波场地址
const containsTronAddress = (text: string): boolean => {
  const words = text.split(/\s+/);
  return words.some((word) => TRON_ADDRESS_REGEX.test(word));
};

// 检查关键词是否匹配
const isKeywordMatch = (
  keyword: string,
  messageText: string,
  isFuzzy = false,
): boolean => {
  // 特殊关键词：<tron_address> 匹配所有波场地址
  if (keyword === '<tron_address>') {
    return containsTronAddress(messageText);
  }
  // 模糊匹配：消息包含关键词即触发
  if (isFuzzy) {
    return messageText.includes(keyword);
  }
  // 精确匹配：完全相等
  return messageText === keyword;
};

// 延迟删除消息
const scheduleMessageDeletion = (
  ctx: MyContext,
  chatId: number,
  messageId: number,
  delaySeconds: number,
): void => {
  if (delaySeconds <= 0) return;

  setTimeout(async () => {
    try {
      await ctx.api.deleteMessage(chatId, messageId);
      debug(`Deleted message ${messageId} after ${delaySeconds} seconds`);
    } catch (error) {
      debug('Error deleting message:', error);
    }
  }, delaySeconds * 1000);
};

const replyRuleHandler: Middleware<MyContext> = async (ctx, next) => {
  // 只处理文本消息
  if (!ctx.message?.text) {
    return next();
  }

  const messageText = ctx.message.text;
  const botId = ctx.currentBot?._id;

  if (!botId) {
    return next();
  }

  debug('Checking reply rules for message:', messageText);

  try {
    // 必须在群组内才触发（私聊没有 currentGroup，直接跳过）
    const currentGroupId = ctx.currentGroup?._id?.toString();
    if (!currentGroupId) {
      return next();
    }

    // 只查询当前群组的在线规则，利用索引 { bot, group, isOnline }
    const replyRules = await ReplyRule.find({
      bot: botId,
      group: ctx.currentGroup!._id,
      isOnline: true,
    }).exec();

    // 查找第一个关键词匹配的规则
    const matchedRule = replyRules.find((rule) => {
      debug(
        'Checking rule:',
        rule._id,
        'isFuzzy:',
        rule.isFuzzy,
        'keywords:',
        rule.keyword,
      );
      return rule.keyword.some((kw) => {
        const match = isKeywordMatch(kw, messageText, rule.isFuzzy);
        debug('Keyword:', kw, 'match:', match);
        return match;
      });
    });

    if (!matchedRule) {
      return next();
    }

    debug('Matched reply rule:', matchedRule._id);

    // 构建成员信息用于变量替换
    const user = ctx.from;
    const memberInfo: MemberInfo | undefined = user
      ? {
          id: user.id,
          username: user.username,
          firstName: user.first_name,
          lastName: user.last_name,
        }
      : undefined;

    // 获取群组标题
    const groupTitle =
      ctx.chat?.type !== 'private' ? (ctx.chat as any)?.title || '' : '';

    // 检查是否需要排名数据（只有内容包含排名相关变量时才获取）
    const needsRankingData =
      matchedRule.content.includes('{userBalanceRankingList}') ||
      matchedRule.content.includes('{userBalanceRanking}');

    let userBalanceRanking = 0;
    let userBalanceRankingList = '';
    let rankingListData: any = { hasNext: false, total: 0 };

    if (needsRankingData) {
      // 获取用户积分排名
      // 获取当前群组的所有成员 ID
      const groupMembers = await BotUser.find({
        groups: ctx.currentGroup._id,
      }).select('_id');
      const groupMemberIds = groupMembers.map((m) => m._id);

      userBalanceRanking = await getGroupUserRanking(
        botId,
        ctx.currentBotUserConfig?.usdt_balance || 0,
        groupMemberIds,
      );

      // 获取用户积分榜单
      rankingListData = await getGroupUserRankingList(
        ctx,
        botId,
        groupMemberIds,
        1,
        ITEMS_PER_PAGE,
      );
      userBalanceRankingList = rankingListData.text;
    }

    // 替换变量
    const content = replaceVariables(
      matchedRule.content,
      memberInfo,
      groupTitle,
      ctx.currentBotUserConfig?.usdt_balance,
      `@${ctx.currentBot?.userName}`,
      userBalanceRanking,
      userBalanceRankingList,
    );

    // 构建内联键盘
    const inlineButtons: any[] = [];

    // 只有在需要排名数据且有分页时，才添加分页按钮
    if (
      needsRankingData &&
      (rankingListData.hasNext || rankingListData.total > ITEMS_PER_PAGE)
    ) {
      const currentPage = 1;
      const buttons = [];
      if (currentPage > 1) {
        buttons.push({
          text: '⬅️ 上一页',
          callback_data: `rank_page_${currentPage - 1}`,
        });
      }
      if (rankingListData.hasNext) {
        buttons.push({
          text: '下一页 ➡️',
          callback_data: `rank_page_${currentPage + 1}`,
        });
      }
      if (buttons.length > 0) {
        inlineButtons.push(buttons);
      }
    }

    // 构建回复选项
    const replyOptions: any = {
      parse_mode: 'HTML' as const,
      link_preview_options: { is_disabled: true },
    };

    // 是否引用用户消息
    if (matchedRule.replyToMessage) {
      replyOptions.reply_to_message_id = ctx.message.message_id;
    }

    // 合并自定义菜单
    if (matchedRule.menus && matchedRule.menus.length > 0) {
      const customKeyboard = buildInlineKeyboard(matchedRule.menus);
      if (customKeyboard && customKeyboard.inline_keyboard) {
        inlineButtons.push(...customKeyboard.inline_keyboard);
      }
    }

    if (inlineButtons.length > 0) {
      replyOptions.reply_markup = { inline_keyboard: inlineButtons };
    }

    // 发送回复
    let sentMessage: any;

    // 检查是否有媒体文件
    if (matchedRule.medias && matchedRule.medias.length > 0) {
      const result = await sendMediaMessageWithContext(
        ctx,
        matchedRule.medias,
        {
          caption: content,
          parse_mode: 'HTML',

          reply_markup:
            inlineButtons.length > 0
              ? { inline_keyboard: inlineButtons }
              : undefined,
          reply_to_message_id: matchedRule.replyToMessage
            ? ctx.message.message_id
            : undefined,
        },
      );
      sentMessage = { message_id: result.message_id };
    } else {
      // 纯文本回复
      sentMessage = await ctx.reply(content, replyOptions);
    }

    // 阅后即焚 - 删除机器人回复
    if (matchedRule.deleteAfterSeconds > 0 && sentMessage) {
      scheduleMessageDeletion(
        ctx,
        ctx.chat!.id,
        sentMessage.message_id,
        matchedRule.deleteAfterSeconds,
      );
    }

    // 删除用户原始消息
    if (matchedRule.deleteUserMsgAfterSeconds > 0) {
      scheduleMessageDeletion(
        ctx,
        ctx.chat!.id,
        ctx.message.message_id,
        matchedRule.deleteUserMsgAfterSeconds,
      );
    }

    // 已处理，不继续传递
    return;
  } catch (error) {
    debug('Error in replyRuleHandler:', error);
    return next();
  }
};

export default replyRuleHandler;
