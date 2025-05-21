import { Composer } from 'grammy';
import helpCommand from './help';
import helpCallback from './callback';
// 创建一个新的 Composer 实例
const helpComposer = new Composer();

helpComposer.use(helpCommand.middleware());
helpComposer.use(helpCallback.middleware());

export default helpComposer;
