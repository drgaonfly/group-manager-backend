// src/composers/index.ts
import { Composer } from 'grammy';
import useCommand from './use';

// 创建一个新的 Composer 实例
const useComposerCommand = new Composer();

useComposerCommand.use(useCommand.middleware());

export default useComposerCommand;
