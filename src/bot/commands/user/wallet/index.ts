import { Composer } from 'grammy';
import showCommand from './show';

const walletComposer = new Composer();

walletComposer.use(showCommand.middleware());

export default walletComposer;
