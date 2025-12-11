import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import speechPerDayCommand from './speechPerDay';
import speechPerWeekCommand from './speechPerWeek';
import speechPerMonthCommand from './speechPerMonth';
import paginationComposer from './pagination';
import { checkSpeechStatic } from '../../../middlewares/checkSpeechStatic';

const speechStaticComposer = new Composer<MyContext>();

// 先检查是否开启群内统计功能
speechStaticComposer.use(checkSpeechStatic);

// 合并所有命令
speechStaticComposer.use(speechPerDayCommand);
speechStaticComposer.use(speechPerWeekCommand);
speechStaticComposer.use(speechPerMonthCommand);

// 分页回调
speechStaticComposer.use(paginationComposer);

export default speechStaticComposer;
