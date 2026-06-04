import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import grabCallbackQuery from './grabCallbackQuery';

const redpacketComposer = new Composer<MyContext>();

redpacketComposer.use(grabCallbackQuery.middleware());

export default redpacketComposer;
