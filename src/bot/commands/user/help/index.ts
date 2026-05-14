import { Composer } from 'grammy';
import helpCommand from './help';

// 创建一个新的 Composer 实例
const helpComposer = new Composer();

helpComposer.use(helpCommand.middleware());

export default helpComposer;
