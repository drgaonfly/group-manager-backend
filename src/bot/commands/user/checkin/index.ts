import { Composer } from 'grammy';
import checkinCommand from './checkin';

const checkinComposer = new Composer();

checkinComposer.use(checkinCommand.middleware());

export default checkinComposer;
