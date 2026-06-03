import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import redpacketCommand from './redpacketCommand';
import grabCallbackQuery from './grabCallbackQuery';
// webAppDataQuery 在 botSetup.ts 顶层注册，不在此注册（确保私聊 web_app_data 能被收到）

const redpacketComposer = new Composer<MyContext>();

redpacketComposer.use(redpacketCommand.middleware());
redpacketComposer.use(grabCallbackQuery.middleware());

export default redpacketComposer;
