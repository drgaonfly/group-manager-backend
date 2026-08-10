import BotUser from '../../models/botUser';
import { MyContext } from '../types';

/**
 * 获取群组成员 ID 列表
 *
 * 这是一个辅助函数，用于从新的 BotUser.groups 结构中获取群组成员，
 * 替代原来的 ctx.currentGroup?.botUsers
 *
 * @param groupId 群组 ID
 * @returns 成员 ID 数组
 */
export async function getGroupMemberIds(groupId: string): Promise<string[]> {
  const groupMembers = await BotUser.find({
    groups: groupId,
  }).select('_id');

  return groupMembers.map((m) => m._id.toString());
}

/**
 * 从上下文中获取当前群组的成员 ID 列表
 *
 * @param ctx Bot 上下文
 * @returns 成员 ID 数组，如果没有群组则返回空数组
 */
export async function getCurrentGroupMemberIds(
  ctx: MyContext,
): Promise<string[]> {
  if (!ctx.currentGroup?._id) {
    return [];
  }

  return getGroupMemberIds(ctx.currentGroup._id.toString());
}
