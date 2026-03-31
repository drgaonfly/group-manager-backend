import { Composer } from 'grammy';
import findTeacherCommand from './findTeacher';
import myReviewedsCommand from './myRevieweds';
import { MyContext } from '../../../types';

const teachingComposer = new Composer<MyContext>();

teachingComposer.use(findTeacherCommand);
teachingComposer.use(myReviewedsCommand);

export default teachingComposer;
