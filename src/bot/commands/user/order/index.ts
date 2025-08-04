import { Composer } from 'grammy';
import orderCommand from './order';

// 创建一个新的 Composer 实例
const orderComposer = new Composer();

orderComposer.use(orderCommand.middleware());

export default orderComposer;
