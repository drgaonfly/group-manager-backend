import { Bot, GrammyError, HttpError, session } from 'grammy';
import Lottery from '../models/lottery';
import Auction from '../models/auction';
import logger from './middlewares/logger';
import userComposer from './commands/user';
import errorHandler from './middlewares/errorHandler';
import botResolver from './middlewares/botResolver';
import botUserResolver from './middlewares/botUserResolver';
import groupResolver from './middlewares/groupResolver';
import replyRuleHandler from './middlewares/replyRuleHandler';
import { rankingPaginationHandler } from './middlewares/rankingPaginationHandler';
import { privateCommandsList, groupCommandsList } from './commandsList';
import { SocksProxyAgent } from 'socks-proxy-agent';
import botUserConfigResolver from './middlewares/botUserConfigResolver';
import proxyResolver from './middlewares/proxyResolver';
import { adRemovalResolver } from './middlewares/adRemovalResolver';
import { MyContext } from './types'; // 引入你的 MyContext 类型
import { hydrateFiles } from '@grammyjs/files';
import { RedisAdapter } from '@grammyjs/storage-redis';
import { redis } from '../utils/redis';
import { conversations } from '@grammyjs/conversations';
import { autoQuote } from '@roziscoding/grammy-autoquote';
import createDebug from 'debug';

const log = createDebug('bot:setup');

export const printWebhookInfo = async (bot: Bot) => {
  const info = await bot.api.getWebhookInfo();
  const debug = createDebug('bot:webhook');
  debug(`webhook info`);
  debug(info);
  return info;
};

export const setupBot = (token: string) => {
  const storage = new RedisAdapter({
    instance: redis,
    ttl: 10,
    autoParseDates: true,
  });
  const SOCKS_PROXY_URL = process.env.SOCKS_PROXY_URL; // SOCKS 代理 URL，例如 'socks5://username:password@host:port'

  // 定义 bot 变量
  let bot: Bot<MyContext>;

  if (SOCKS_PROXY_URL) {
    // 创建 SOCKS 代理代理
    const socksAgent = new SocksProxyAgent(process.env.SOCKS_PROXY_URL);

    // 使用代理初始化 Bot
    bot = new Bot<MyContext>(token, {
      client: {
        baseFetchConfig: {
          agent: socksAgent,
          compress: true,
        },
      },
    });

    log('Bot 正在使用 SOCKS 代理：', SOCKS_PROXY_URL);
  } else {
    // 未设置代理，正常初始化 Bot
    bot = new Bot<MyContext>(token);
    log('Bot 未使用代理。');
  }

  // 使用 session 中间件
  bot.use(
    session({
      initial: () => ({}),
      storage,
    }),
  );

  bot.use(autoQuote());

  // 由于 session 已经合并到 context，后续中间件类型也要兼容 MyContext
  // 需要确保所有中间件都用 MyContext 类型
  bot.use(conversations());
  bot.use(botResolver);
  bot.use(botUserResolver);
  bot.use(botUserConfigResolver);
  bot.use(groupResolver);
  bot.use(proxyResolver);
  bot.use(errorHandler);

  // 处理广告的优先级高于一般消息处理
  bot.use(adRemovalResolver);

  bot.use(logger);
  bot.use(rankingPaginationHandler);
  bot.use(replyRuleHandler);
  bot.use(userComposer.middleware());
  // bot.use(adminComposer.middleware());

  // bot.command("start", (ctx) => ctx.reply("Welcome! Up and running."));

  // 回复任何消息 "Hi there!"。
  // bot.on('message', (ctx) => ctx.reply('Hi there!'));

  bot.callbackQuery('close', async (ctx) => {
    log('用户点击了按钮: close');
    await ctx.conversation.exitAll();
    // 删除原消息
    await ctx.deleteMessage();
    // 可选：发送反馈提示（客户端显示短暂提示）
    await ctx.answerCallbackQuery({ text: '消息已删除' });
  });

  bot.on('callback_query:data', async (ctx) => {
    log('callback_query:data');
    const data = ctx.callbackQuery?.data;
    log(`用户点击了按钮: ${data}`);

    // 处理竞拍参与按钮
    if (data?.startsWith('auction_join_')) {
      const auctionId = data.replace('auction_join_', '');
      log(`用户点击了竞拍参与按钮，竞拍ID: ${auctionId}`);

      try {
        // 导入必要的模块

        // 查找竞拍活动
        const auction = await Auction.findById(auctionId);
        if (!auction) {
          await ctx.answerCallbackQuery({
            text: '❌ 竞拍活动不存在',
            show_alert: true,
          });
          return;
        }

        if (auction.status !== 'ongoing') {
          await ctx.answerCallbackQuery({
            text: '❌ 竞拍活动已结束',
            show_alert: true,
          });
          return;
        }

        // 检查是否已过期
        if (new Date() >= new Date(auction.endTime)) {
          await ctx.answerCallbackQuery({
            text: '❌ 竞拍活动已过期',
            show_alert: true,
          });
          return;
        }

        // 获取当前最高出价
        let currentHighest = auction.startingPrice;
        let minimumBid = auction.startingPrice + auction.minBidIncrement;

        if (auction.bids && auction.bids.length > 0) {
          currentHighest = Math.max(
            ...auction.bids.map((b: any) => b.bidAmount),
          );
          minimumBid = currentHighest + auction.minBidIncrement;
        }

        // 构建参与提示消息
        const keywords = auction.keywords.join(' 或 ');
        const endTime = new Date(auction.endTime).toLocaleString('zh-CN');

        const participateMessage =
          `🏆 竞拍参与方法：\n\n` +
          `📝 在群组中发送关键词：\n` +
          `💬 ${keywords}\n\n` +
          `💰 当前最高价：${currentHighest}积分\n` +
          `📈 最低出价：${minimumBid}积分\n` +
          `📊 加价区间：${auction.minBidIncrement}-${auction.maxBidIncrement}积分\n` +
          `⏰ 结束时间：${endTime}\n\n` +
          `💡 出价方式：\n` +
          `1. 先发送关键词参与\n` +
          `2. 回复机器人消息并输入出价金额`;

        await ctx.answerCallbackQuery({
          text: participateMessage,
          show_alert: true,
        });
      } catch (error) {
        log('处理竞拍参与按钮失败:', error);
        await ctx.answerCallbackQuery({
          text: '❌ 处理失败，请稍后重试',
          show_alert: true,
        });
      }
      return;
    }

    // 处理抽奖参与按钮
    if (data?.startsWith('lottery_join_')) {
      const lotteryId = data.replace('lottery_join_', '');
      log(`用户点击了抽奖参与按钮，抽奖ID: ${lotteryId}`);

      try {
        // 导入必要的模块

        // 查找抽奖活动
        const lottery = await Lottery.findById(lotteryId);
        if (!lottery) {
          await ctx.answerCallbackQuery({
            text: '❌ 抽奖活动不存在',
            show_alert: true,
          });
          return;
        }

        if (lottery.status !== 'ongoing') {
          await ctx.answerCallbackQuery({
            text: '❌ 抽奖活动已结束',
            show_alert: true,
          });
          return;
        }

        // 构建参与提示消息
        const keywords = lottery.keywords.join(' 或 ');
        const participateMessage =
          `🎯 参与抽奖方法：\n\n` +
          `📝 在群组中发送以下关键词之一：\n` +
          `💬 ${keywords}\n\n` +
          `🎁 奖品：\n${lottery.prizes
            .map(
              (p: any, i: number) =>
                `${i + 1}. ${p.name} - ${p.value}积分 x${p.quantity}份`,
            )
            .join('\n')}\n\n` +
          `⏰ 开奖条件：\n${
            lottery.drawMethod.includes('fullParticipants')
              ? `满${lottery.fullParticipantsCount}人开奖`
              : ''
          }${
            lottery.drawMethod.includes('scheduledTime') &&
            lottery.scheduledDrawTime
              ? `\n定时开奖: ${new Date(
                  lottery.scheduledDrawTime,
                ).toLocaleString('zh-CN')}`
              : ''
          }`;

        await ctx.answerCallbackQuery({
          text: participateMessage,
          show_alert: true,
        });
      } catch (error) {
        log('处理抽奖参与按钮失败:', error);
        await ctx.answerCallbackQuery({
          text: '❌ 处理失败，请稍后重试',
          show_alert: true,
        });
      }
      return;
    }

    // 默认处理
    await ctx.answerCallbackQuery(`您点击了按钮: ${data}`);
  });

  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`);
    const e = err.error;
    if (e instanceof GrammyError) {
      console.error('Error in request:', e.description);
    } else if (e instanceof HttpError) {
      console.error('Could not contact Telegram:', e);
    } else {
      console.error('Unknown error:', e);
    }
  });

  // 设置私聊命令（只保留 /start）
  bot.api
    .setMyCommands(privateCommandsList, {
      scope: { type: 'all_private_chats' },
    })
    .then(() => {
      log('私聊命令已设置成功');
    })
    .catch((error) => {
      log('设置私聊命令时发生错误:', error);
    });

  // 不再设置群组命令
  if (groupCommandsList.length > 0) {
    bot.api
      .setMyCommands(groupCommandsList, { scope: { type: 'all_group_chats' } })
      .then(() => {
        log('群组命令已设置成功');
      })
      .catch((error) => {
        log('设置群组命令时发生错误:', error);
      });
  }

  bot.api.config.use(hydrateFiles(token));

  return bot;
};
