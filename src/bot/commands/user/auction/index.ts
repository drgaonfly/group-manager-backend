import { Composer } from 'grammy';
import { auctionCommand } from './auction';
import { auctionCreateCommand } from './create';
import { auctionHistoryCommand } from './history';

// 创建一个新的 Composer 实例
const auctionComposer = new Composer();

auctionComposer.use(auctionCommand);
auctionComposer.use(auctionCreateCommand);
auctionComposer.use(auctionHistoryCommand);

export default auctionComposer;
