import mongoose, { Document } from 'mongoose';
import { IBot } from './bot';
import { IGroup } from './group';
import { IUser } from './user';

export interface IServiceMessage extends Document {
  proxy: mongoose.Schema.Types.ObjectId | IUser;
  bot: mongoose.Schema.Types.ObjectId | IBot;
  group: mongoose.Schema.Types.ObjectId | IGroup;

  // 成员变动类
  isJoinGroupDeleted: boolean; // 新成员加入消息 (new_chat_members)
  isLeftGroupDeleted: boolean; // 成员离开消息 (left_chat_member)

  // 群组信息类
  isNewTitleDeleted: boolean; // 修改标题消息 (new_chat_title)
  isNewPhotoDeleted: boolean; // 修改头像消息 (new_chat_photo)
  isDeletePhotoDeleted: boolean; // 删除头像消息 (delete_chat_photo)

  // 消息操作类
  isPinnedMessageDeleted: boolean; // 置顶消息 (pinned_message)

  // 论坛话题类
  isForumTopicCreatedDeleted: boolean; // 创建话题 (forum_topic_created)
  isForumTopicEditedDeleted: boolean; // 编辑话题 (forum_topic_edited)
  isForumTopicClosedDeleted: boolean; // 关闭话题 (forum_topic_closed)
  isForumTopicReopenedDeleted: boolean; // 重新打开话题 (forum_topic_reopened)
  isGeneralTopicHiddenDeleted: boolean; // 隐藏通用话题 (general_forum_topic_hidden)
  isGeneralTopicUnhiddenDeleted: boolean; // 显示通用话题 (general_forum_topic_unhidden)

  // 助推类
  isBoostAddedDeleted: boolean; // 用户助推消息 (boost_added)

  // 语音/视频通话类
  isVideoChatStartedDeleted: boolean; // 视频聊天开始 (video_chat_started)
  isVideoChatEndedDeleted: boolean; // 视频聊天结束 (video_chat_ended)
  isVideoChatScheduledDeleted: boolean; // 视频聊天计划 (video_chat_scheduled)
  isVideoChatInvitedDeleted: boolean; // 邀请参与视频聊天 (video_chat_participants_invited)

  // 权限授予类（核对清单）
  isWriteAccessAllowedDeleted: boolean; // 写入权限授予 (write_access_allowed)

  // 群组迁移类
  isMigrateDeleted: boolean; // 群组升级消息 (migrate_to_chat_id / migrate_from_chat_id)

  // 其他设置
  isActive: boolean; // 是否启用此配置
  deleteDelay?: number; // 延迟删除（秒），0=立即删除

  createdAt: Date;
  updatedAt: Date;
}

const serviceMessageSchema = new mongoose.Schema(
  {
    proxy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    bot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bot',
      required: true,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
    },

    // ============ 成员变动 ============
    isJoinGroupDeleted: { type: Boolean, default: false },
    isLeftGroupDeleted: { type: Boolean, default: false },

    // ============ 群组信息 ============
    isNewTitleDeleted: { type: Boolean, default: false },
    isNewPhotoDeleted: { type: Boolean, default: false },
    isDeletePhotoDeleted: { type: Boolean, default: false },

    // ============ 消息操作 ============
    isPinnedMessageDeleted: { type: Boolean, default: false },

    // ============ 论坛话题 ============
    isForumTopicCreatedDeleted: { type: Boolean, default: false },
    isForumTopicEditedDeleted: { type: Boolean, default: false },
    isForumTopicClosedDeleted: { type: Boolean, default: false },
    isForumTopicReopenedDeleted: { type: Boolean, default: false },
    isGeneralTopicHiddenDeleted: { type: Boolean, default: false },
    isGeneralTopicUnhiddenDeleted: { type: Boolean, default: false },

    // ============ 助推 ============
    isBoostAddedDeleted: { type: Boolean, default: false },

    // ============ 语音/视频通话 ============
    isVideoChatStartedDeleted: { type: Boolean, default: false },
    isVideoChatEndedDeleted: { type: Boolean, default: false },
    isVideoChatScheduledDeleted: { type: Boolean, default: false },
    isVideoChatInvitedDeleted: { type: Boolean, default: false },

    // ============ 权限授予（核对清单）============
    isWriteAccessAllowedDeleted: { type: Boolean, default: false },

    // ============ 群组迁移 ============
    isMigrateDeleted: { type: Boolean, default: false },

    // ============ 其他设置 ============
    isActive: { type: Boolean, default: true },
    deleteDelay: { type: Number, default: 0, min: 0, max: 300 },
  },
  { timestamps: true },
);

// 索引
serviceMessageSchema.index({ bot: 1, group: 1 }, { unique: true });
serviceMessageSchema.index({ bot: 1 });
serviceMessageSchema.index({ proxy: 1 });
serviceMessageSchema.index({ group: 1 });
serviceMessageSchema.index({ isActive: 1 });

const ServiceMessage = mongoose.model<IServiceMessage>(
  'ServiceMessage',
  serviceMessageSchema,
);

export default ServiceMessage;
