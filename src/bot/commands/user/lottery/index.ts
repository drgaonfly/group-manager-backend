import { Composer } from 'grammy';
import { lotteryCommand } from './lottery';
import { lotteryCreateCommand } from './create';
import { lotteryHistoryCommand } from './history';
import lotteryCallbacksComposer from './lotteryCallbacks';

const lotteryComposer = new Composer();

lotteryComposer.use(lotteryCreateCommand.middleware());
lotteryComposer.use(lotteryHistoryCommand.middleware());
lotteryComposer.use(lotteryCommand.middleware());
lotteryComposer.use(lotteryCallbacksComposer.middleware());

export default lotteryComposer;
