import { Composer } from 'grammy';
import startCommand from './start';
import startCallback from './callback';
// 创建一个新的 Composer 实例
const startComposer = new Composer();

startComposer.use(startCommand.middleware());
startComposer.use(startCallback.middleware());

export default startComposer;
