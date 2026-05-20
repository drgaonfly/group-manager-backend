import { Composer } from 'grammy';
import { auctionCommand } from './auction';
import { auctionCreateCommand } from './create';
import { auctionHistoryCommand } from './history';
import auctionCallbacksComposer from './auctionCallbacks';

const auctionComposer = new Composer();

auctionComposer.use(auctionCommand);
auctionComposer.use(auctionCreateCommand);
auctionComposer.use(auctionHistoryCommand);
auctionComposer.use(auctionCallbacksComposer.middleware());

export default auctionComposer;
