import { IUser } from '../../models/user';
import { IBot } from '../../models/bot';

/**
 * 检查用户权限的工具函数。
 *
 * 权限采用单层控制：只由平台授予代理用户的功能字段决定，
 * Bot 自身的 canXxx 开关不再参与判断（已废弃双重门控）。
 * bot 参数保留以维持调用兼容性，但不参与逻辑。
 */
export class PermissionChecker {
  static canUseSpeechStatic(proxyUser: IUser | null, _bot?: IBot): boolean {
    return !!proxyUser?.speech_static;
  }

  static canUseGroupMessaging(proxyUser: IUser | null, _bot?: IBot): boolean {
    return !!proxyUser?.groupMessage;
  }

  static canUseGroupWelcome(proxyUser: IUser | null, _bot?: IBot): boolean {
    return !!proxyUser?.groupWelcome;
  }

  static canUseChannelPost(proxyUser: IUser | null, _bot?: IBot): boolean {
    return !!proxyUser?.channelPost;
  }

  static canUseGroupVerify(proxyUser: IUser | null, _bot?: IBot): boolean {
    return !!proxyUser?.groupVerify;
  }

  static canUseReplyRule(proxyUser: IUser | null, _bot?: IBot): boolean {
    return !!proxyUser?.replyRule;
  }

  static canUseCheckinRule(proxyUser: IUser | null, _bot?: IBot): boolean {
    return !!proxyUser?.checkinRule;
  }

  static canUseLotteryRule(proxyUser: IUser | null, _bot?: IBot): boolean {
    return !!proxyUser?.lotteryRule;
  }

  static canUseAuctionRule(proxyUser: IUser | null, _bot?: IBot): boolean {
    return !!proxyUser?.auctionRule;
  }

  static canUseAdRemoval(proxyUser: IUser | null, _bot?: IBot): boolean {
    return !!proxyUser?.adRemoval;
  }

  static canUseServiceMessage(proxyUser: IUser | null, _bot?: IBot): boolean {
    return !!proxyUser?.serviceMessage;
  }

  static canUseSuccess(proxyUser: IUser | null, _bot?: IBot): boolean {
    return !!proxyUser?.success;
  }

  static canUseRedPacket(proxyUser: IUser | null, _bot?: IBot): boolean {
    return !!proxyUser?.redPacket;
  }

  /** 获取所有功能的可用状态 */
  static getAllPermissions(proxyUser: IUser | null, _bot?: IBot) {
    return {
      speechStatic: this.canUseSpeechStatic(proxyUser),
      groupMessaging: this.canUseGroupMessaging(proxyUser),
      groupWelcome: this.canUseGroupWelcome(proxyUser),
      channelPost: this.canUseChannelPost(proxyUser),
      groupVerify: this.canUseGroupVerify(proxyUser),
      replyRule: this.canUseReplyRule(proxyUser),
      checkinRule: this.canUseCheckinRule(proxyUser),
      lotteryRule: this.canUseLotteryRule(proxyUser),
      auctionRule: this.canUseAuctionRule(proxyUser),
      adRemoval: this.canUseAdRemoval(proxyUser),
      serviceMessage: this.canUseServiceMessage(proxyUser),
      success: this.canUseSuccess(proxyUser),
      redPacket: this.canUseRedPacket(proxyUser),
    };
  }
}
