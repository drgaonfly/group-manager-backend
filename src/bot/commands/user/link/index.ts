import { Composer } from 'grammy';
import linkCommand from './link';

// 创建一个新的 Composer 实例
const linkComposer = new Composer();

linkComposer.use(linkCommand.middleware());

export default linkComposer;
