import { Composer } from 'grammy';
import { MyContext } from '../../types';
import { findBotProxy } from '../../services/findBotProxy';
import { syncGroupAdministrators } from '../../services/syncGroupAdministrators';
import createDebug from 'debug';

const debug = createDebug('bot:command:syncAdmins');

const syncAdminsComposer = new Composer<MyContext>();

// 命令: /syncadmins - 同步群组管理员
syncAdminsComposer.command('syncadmins', async (ctx) => {
  if (!ctx.currentGroup) {
    await ctx.reply('⚠️ 此命令只能在群组中使用');
    return;
  }

  // 发送处理中消息
  const processingMsg = await ctx.reply('🔄 正在同步群组管理员信息...');

  try {
    const { proxyUser } = await findBotProxy(ctx.currentBot);

    const result = await syncGroupAdministrators(
      ctx,
      ctx.currentGroup,
      proxyUser,
    );

    if (result.success && result.data) {
      const { adminCount, hasCreator, adminList } = result.data;

      let message = `✅ 同步完成！\n\n`;
      message += `📊 统计信息:\n`;
      message += `• 管理员总数: ${adminCount}\n`;
      message += `• 群主状态: ${hasCreator ? '已识别' : '未识别'}\n\n`;

      if (adminList && adminList.length > 0) {
        message += `👥 管理员列表:\n`;
        message += adminList.join('\n');
      }

      await ctx.api.editMessageText(
        ctx.chat!.id,
        processingMsg.message_id,
        message,
      );
    } else {
      await ctx.api.editMessageText(
        ctx.chat!.id,
        processingMsg.message_id,
        `❌ ${result.message}`,
      );
    }
  } catch (error: any) {
    debug('执行 syncadmins 命令失败:', error);
    await ctx.api.editMessageText(
      ctx.chat!.id,
      processingMsg.message_id,
      `❌ 同步失败: ${error.message}`,
    );
  }
});

export default syncAdminsComposer;
