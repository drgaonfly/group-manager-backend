import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import postComposer from './post';

const postIndexComposer = new Composer<MyContext>();

postIndexComposer.use(postComposer.middleware());

export default postIndexComposer;
