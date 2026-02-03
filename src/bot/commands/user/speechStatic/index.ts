import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import speechPerDayCommand from './speechPerDay';
import speechPerWeekCommand from './speechPerWeek';
import speechPerMonthCommand from './speechPerMonth';
import paginationComposer from './pagination';

const speechStaticComposer = new Composer<MyContext>();

// 合并所有命令
speechStaticComposer.use(speechPerDayCommand);
speechStaticComposer.use(speechPerWeekCommand);
speechStaticComposer.use(speechPerMonthCommand);

// 分页回调
speechStaticComposer.use(paginationComposer);

export default speechStaticComposer;
