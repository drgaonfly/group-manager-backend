import { Composer } from 'grammy';
import spreadCommand from './spread';

// 创建一个新的 Composer 实例
const spreadComposer = new Composer();

spreadComposer.use(spreadCommand.middleware());
spreadComposer.use(spreadCommand.middleware());

export default spreadComposer;
