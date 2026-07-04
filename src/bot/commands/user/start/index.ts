import { Composer } from 'grammy';
import startCommand from './start';
// 创建一个新的 Composer 实例
const startComposer = new Composer();

startComposer.use(startCommand.middleware());

export default startComposer;
