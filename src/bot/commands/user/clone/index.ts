import { Composer } from 'grammy';
import handleTokenComposer from './handleToken';

const cloneComposer = new Composer();

cloneComposer.use(handleTokenComposer.middleware());

export default cloneComposer;
