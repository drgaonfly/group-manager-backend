import { Composer } from 'grammy';
import { MyContext } from '../../types';
import { basicResolver } from './basicResolver';
import { botJoinLeaveHandler } from './botJoinLeaveHandler';
import { groupMigrationHandler } from './groupMigrationHandler';
import { memberJoinLeaveHandler } from './memberJoinLeaveHandler';
import { channelSubscriptionHandler } from './channelSubscriptionHandler';
import { adminManagementHandler } from './adminChangedHandler';
import { botAdminPromptHandler } from './botAdminPromptHandler';
import { groupVerifyHandler } from './groupVerifyHandler';
import { groupWelcomeHandler } from './groupWelcomeHandler';
import { groupUpdateHandler } from './groupUpdateHandler';
import { groupSpeechStatistics } from './groupSpeechStatistics';

/**
 * 群组解析器 - 组合所有群组相关中间件
 *
 * 中间件执行顺序：
 * 1. basicResolver - 基础群组信息解析
 * 2. botJoinLeaveHandler - Bot 加入/退出处理
 * 3. groupMigrationHandler - 群组升级处理
 * 4. memberJoinLeaveHandler - 成员加入/离开处理
 * 5. channelSubscriptionHandler - 频道订阅处理
 * 6. adminChangedHandler - 管理员提升/撤销处理、群主转移处理
 * 7. botAdminPromptHandler - Bot 被提升为管理员提示
 * 8. groupVerifyHandler - 群组验证处理（新成员）
 * 9. groupWelcomeHandler - 群组欢迎处理（新成员）
 * 10. groupUpdateHandler - 群组更新处理（维护 botUsers 列表）
 * 11. groupSpeechStatistics - 群组发言统计记录
 */
const groupResolver = new Composer<MyContext>();

// 按顺序注册中间件
groupResolver.use(basicResolver);
groupResolver.use(groupMigrationHandler); // 迁移处理必须在 botJoinLeave 之前，避免误建重复记录
groupResolver.use(botJoinLeaveHandler);
groupResolver.use(memberJoinLeaveHandler);
groupResolver.use(channelSubscriptionHandler);
groupResolver.use(adminManagementHandler);
groupResolver.use(botAdminPromptHandler);
groupResolver.use(groupVerifyHandler);
groupResolver.use(groupWelcomeHandler);
groupResolver.use(groupUpdateHandler);
groupResolver.use(groupSpeechStatistics);

export default groupResolver;
