import { MyContext } from '../../../types';
import { Composer } from 'grammy';
import findTeacherCommand from './findTeacher';
import myReviewedsCommand from './myRevieweds';
import setAvailableCommand from './setAvailable';
import menuingTeacherCommand from './menuingTeacher';
import nearbyTeacherComposer from './nearbyTeacher';

const teachingComposer = new Composer<MyContext>();

teachingComposer.use(menuingTeacherCommand);
teachingComposer.use(findTeacherCommand);
teachingComposer.use(myReviewedsCommand);
teachingComposer.use(setAvailableCommand);
teachingComposer.use(nearbyTeacherComposer);

export default teachingComposer;
