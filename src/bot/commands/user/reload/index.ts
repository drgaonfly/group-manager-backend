import { Composer } from 'grammy';
import reloadCommand from './reload';

const reloadComposer = new Composer();

reloadComposer.use(reloadCommand.middleware());

export default reloadComposer;
