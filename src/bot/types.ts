import { Context as GrammyContext, SessionFlavor } from 'grammy';
// import { I18nFlavor } from '@grammyjs/i18n';
import { IBot } from '../models/bot';
import { IBotUser } from '../models/botUser';
import { IGroup } from '../models/group';
import { IBotUserConfig } from '../models/botUserConfig';
import { type FileFlavor } from '@grammyjs/files';
import { SessionData } from './sessions';
import { ConversationFlavor } from '@grammyjs/conversations';
import { IUser } from '../models/user';

export interface CustomContext
  extends GrammyContext,
    SessionFlavor<SessionData> {}

// 基础上下文类型
type BaseContext = CustomContext &
  FileFlavor<CustomContext> & {
    currentBot?: IBot;
    currentBotUser?: IBotUser;
    currentGroup?: IGroup;
    currentBotSession?: string;
    currentBotUserConfig?: IBotUserConfig;
    currentProxyUser?: IUser;
    currentProxyBotUser?: IBotUser;
    currentProxyBotUserConfig?: IBotUserConfig;
  };

// 最终上下文类型
export type MyContext = BaseContext & ConversationFlavor<BaseContext>;
