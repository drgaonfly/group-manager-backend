import { Composer } from 'grammy';
import startCommand from './start';
import startCallback from './callback';
import presetCommand from './preset';
import keyboardCommand from './keyboard';
// 创建一个新的 Composer 实例
const startComposer = new Composer();

startComposer.use(startCommand.middleware());
startComposer.use(startCallback.middleware());
startComposer.use(presetCommand.middleware());
startComposer.use(keyboardCommand.middleware());

export default startComposer;
