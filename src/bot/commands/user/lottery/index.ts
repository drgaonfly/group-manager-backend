import { Composer } from 'grammy';
import { lotteryCommand } from './lottery';
import { lotteryCreateCommand } from './create';
import { lotteryHistoryCommand } from './history';

// 创建一个新的 Composer 实例
const lotteryComposer = new Composer();

lotteryComposer.use(lotteryCreateCommand.middleware());
lotteryComposer.use(lotteryHistoryCommand.middleware());
lotteryComposer.use(lotteryCommand.middleware());

export default lotteryComposer;
