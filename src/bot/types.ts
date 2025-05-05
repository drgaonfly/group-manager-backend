import { Context as GrammyContext } from 'grammy';
import { SessionData } from './sessions';
import { SessionFlavor } from 'grammy';

export interface MyContext extends GrammyContext, SessionFlavor<SessionData> {}
