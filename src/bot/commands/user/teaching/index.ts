import { Composer } from 'grammy';
import findTeacherCommand from './findTeacher';
import myReviewedsCommand from './myRevieweds';
import setAvailableCommand from './setAvailable';
import menuingTeacherCommand from './menuingTeacher';
import { MyContext } from '../../../types';

const teachingComposer = new Composer<MyContext>();

teachingComposer.use(menuingTeacherCommand);
teachingComposer.use(findTeacherCommand);
teachingComposer.use(myReviewedsCommand);
teachingComposer.use(setAvailableCommand);

export default teachingComposer;
