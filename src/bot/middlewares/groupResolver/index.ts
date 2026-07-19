import { Composer } from 'grammy';
import { MyContext } from '../../types';
import { basicResolver } from './basicResolver';
import { botJoinLeaveHandler } from './botJoinLeaveHandler';
import { groupMigrationHandler } from './groupMigrationHandler';
import { memberJoinLeaveHandler } from './memberJoinLeaveHandler';
import { channelSubscriptionHandler } from './channelSubscriptionHandler';
import { adminManagementHandler } from './adminChangedHandler';
import { groupVerifyHandler } from './groupVerifyHandler';
import { groupWelcomeHandler } from './groupWelcomeHandler';
import { groupUpdateHandler } from './groupUpdateHandler';

/**
 * 群组解析器 - 组合所有群组相关中间件
 *
 * 中间件执行顺序：
 * 1. basicResolver - 基础群组信息解析
 * 2. botJoinLeaveHandler - Bot 加入/退出处理
 * 3. groupMigrationHandler - 群组升级处理
 * 4. memberJoinLeaveHandler - 成员加入/离开处理
 * 5. channelSubscriptionHandler - 频道订阅处理
 * 6. adminManagementHandler - 管理员提升/撤销处理、群主转移处理
 * 7. groupVerifyHandler - 群组验证处理（新成员）
 * 8. groupWelcomeHandler - 群组欢迎处理（新成员）
 * 9. groupUpdateHandler - 群组更新处理（维护 botUsers 列表）
 */
const groupResolver = new Composer<MyContext>();

// 按顺序注册中间件
groupResolver.use(basicResolver);
groupResolver.use(botJoinLeaveHandler);
groupResolver.use(groupMigrationHandler);
groupResolver.use(memberJoinLeaveHandler);
groupResolver.use(channelSubscriptionHandler);
groupResolver.use(adminManagementHandler);
groupResolver.use(groupVerifyHandler);
groupResolver.use(groupWelcomeHandler);
groupResolver.use(groupUpdateHandler);

export default groupResolver;
