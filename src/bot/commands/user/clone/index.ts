import { Composer } from 'grammy';
import showCommand from './show';
import callbackCommand from './callback';

const cloneComposer = new Composer();

cloneComposer.use(showCommand.middleware());
cloneComposer.use(callbackCommand.middleware());

export default cloneComposer;
