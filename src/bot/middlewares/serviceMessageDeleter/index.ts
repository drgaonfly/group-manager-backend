import { Middleware } from 'grammy';
import { MyContext } from '../../types';
import ServiceMessage, {
  IServiceMessage,
} from '../../../models/serviceMessage';
import { getCache } from '../../../utils/cache';
import createDebug from 'debug';

const debug = createDebug('bot:service-message-deleter');

const TG_API_BASE = 'https://api.telegram.org';

/**
 * 直接用原生 fetch 調用 Telegram deleteMessage。
 * 繞開主 bot 的 apiThrottler，不佔用限流配額，不影響私聊響應。
 * fire-and-forget，不阻塞中間件鏈。
 */
function deleteMessageRaw(
  token: string,
  chatId: number,
  messageId: number,
  messageType: string,
): void {
  fetch(`${TG_API_BASE}/bot${token}/deleteMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
  })
    .then((res) => {
      if (!res.ok) {
        return res.json().then((body: any) => {
          const desc: string = body?.description ?? '';
          if (
            desc.includes('message to delete not found') ||
            desc.includes("message can't be deleted") ||
            desc.includes('bot was kicked') ||
            desc.includes('bot is not a member') ||
            desc.includes('chat not found')
          ) {
            debug(`⚠️ 跳过 [${messageType}] ${messageId}: ${desc}`);
          } else {
            debug(`❌ 删除失败 [${messageType}] ${messageId}: ${desc}`);
          }
        });
      } else {
        debug(`✅ 删除成功 [${messageType}] ${messageId}`);
      }
    })
    .catch((err: any) => {
      debug(`❌ 网络错误 [${messageType}] ${messageId}: ${err.message}`);
    });
}

/**
 * 服务消息删除中间件
 *
 * 检测入群、离群、改标题等系统消息，根据配置决定是否删除。
 * 使用原生 fetch 绕开 apiThrottler，fire-and-forget 不阻塞中间件链。
 */
export const serviceMessageDeleter: Middleware<MyContext> = async (
  ctx,
  next,
) => {
  if (!ctx.message || !ctx.currentGroup || !ctx.currentBot) {
    return await next();
  }

  const msg = ctx.message;

  const hasServiceMessage =
    msg.new_chat_members ||
    msg.left_chat_member ||
    msg.new_chat_title ||
    msg.new_chat_photo ||
    msg.delete_chat_photo ||
    msg.pinned_message ||
    msg.forum_topic_created ||
    msg.forum_topic_edited ||
    msg.forum_topic_closed ||
    msg.forum_topic_reopened ||
    msg.general_forum_topic_hidden ||
    msg.general_forum_topic_unhidden ||
    msg.boost_added ||
    msg.video_chat_started ||
    msg.video_chat_ended ||
    msg.video_chat_scheduled ||
    msg.video_chat_participants_invited ||
    msg.write_access_allowed ||
    msg.migrate_to_chat_id ||
    msg.migrate_from_chat_id;

  if (!hasServiceMessage) {
    return await next();
  }

  const config = await getServiceMessageConfig(ctx);
  if (!config) {
    return await next();
  }

  const messageType = getMessageType(msg, config);
  if (!messageType) {
    return await next();
  }

  const chatId = ctx.chat!.id;
  const messageId = msg.message_id;
  const botToken = ctx.currentBot!.token;

  // fire-and-forget，直接刪，不走隊列不阻塞
  deleteMessageRaw(botToken, chatId, messageId, messageType);

  await next();
};

/**
 * 获取服务消息删除配置（带缓存）
 */
async function getServiceMessageConfig(
  ctx: MyContext,
): Promise<IServiceMessage | null> {
  const cacheKey = `serviceMsg:${ctx.currentBot!._id}:${ctx.currentGroup!._id}`;
  const cache = getCache();

  let config = await cache.get<IServiceMessage | 'NONE'>(cacheKey);

  if (config === undefined || config === null) {
    const found = await ServiceMessage.findOne({
      bot: ctx.currentBot!._id,
      group: ctx.currentGroup!._id,
      isActive: true,
    });

    debug(`数据库查询配置: found=${!!found}`);

    if (found) {
      await cache.set(cacheKey, found, 300000); // 缓存 5 分钟
      return found;
    } else {
      await cache.set(cacheKey, 'NONE', 60000); // 用哨兵值代替 null，1 分钟
      return null;
    }
  }

  if (config === 'NONE') {
    debug(`缓存命中（无配置）: ${cacheKey}`);
    return null;
  }

  debug(`缓存命中: ${cacheKey}`);
  return config as IServiceMessage;
}

/**
 * 根据消息字段和配置判断消息类型，返回类型名称或 null（不需要删除）
 */
function getMessageType(msg: any, config: IServiceMessage): string | null {
  const typeChecks = [
    {
      check: msg.new_chat_members,
      enabled: config.isJoinGroupDeleted,
      name: '新成员加入',
    },
    {
      check: msg.left_chat_member,
      enabled: config.isLeftGroupDeleted,
      name: '成员离开',
    },
    {
      check: msg.new_chat_title,
      enabled: config.isNewTitleDeleted,
      name: '修改群组标题',
    },
    {
      check: msg.new_chat_photo,
      enabled: config.isNewPhotoDeleted,
      name: '修改群组头像',
    },
    {
      check: msg.delete_chat_photo,
      enabled: config.isDeletePhotoDeleted,
      name: '删除群组头像',
    },
    {
      check: msg.pinned_message,
      enabled: config.isPinnedMessageDeleted,
      name: '置顶消息',
    },
    {
      check: msg.forum_topic_created,
      enabled: config.isForumTopicCreatedDeleted,
      name: '创建话题',
    },
    {
      check: msg.forum_topic_edited,
      enabled: config.isForumTopicEditedDeleted,
      name: '编辑话题',
    },
    {
      check: msg.forum_topic_closed,
      enabled: config.isForumTopicClosedDeleted,
      name: '关闭话题',
    },
    {
      check: msg.forum_topic_reopened,
      enabled: config.isForumTopicReopenedDeleted,
      name: '重新打开话题',
    },
    {
      check: msg.general_forum_topic_hidden,
      enabled: config.isGeneralTopicHiddenDeleted,
      name: '隐藏通用话题',
    },
    {
      check: msg.general_forum_topic_unhidden,
      enabled: config.isGeneralTopicUnhiddenDeleted,
      name: '显示通用话题',
    },
    {
      check: msg.boost_added,
      enabled: config.isBoostAddedDeleted,
      name: '用户助推',
    },
    {
      check: msg.video_chat_started,
      enabled: config.isVideoChatStartedDeleted,
      name: '视频聊天开始',
    },
    {
      check: msg.video_chat_ended,
      enabled: config.isVideoChatEndedDeleted,
      name: '视频聊天结束',
    },
    {
      check: msg.video_chat_scheduled,
      enabled: config.isVideoChatScheduledDeleted,
      name: '视频聊天计划',
    },
    {
      check: msg.video_chat_participants_invited,
      enabled: config.isVideoChatInvitedDeleted,
      name: '邀请参与视频聊天',
    },
    {
      check: msg.write_access_allowed,
      enabled: config.isWriteAccessAllowedDeleted,
      name: '写入权限授予',
    },
    {
      check: msg.migrate_to_chat_id || msg.migrate_from_chat_id,
      enabled: config.isMigrateDeleted,
      name: '群组升级',
    },
  ];

  for (const { check, enabled, name } of typeChecks) {
    if (check && enabled) {
      return name;
    }
  }

  return null;
}
