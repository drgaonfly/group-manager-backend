import { Composer } from 'grammy';
import linkCommand from './link';
import myLinkCommand from './mylink';

// 创建一个新的 Composer 实例
const linkComposer = new Composer();

linkComposer.use(linkCommand.middleware());
linkComposer.use(myLinkCommand.middleware());

export default linkComposer;
