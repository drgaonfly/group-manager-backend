import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import { handleWalletList } from './handleWalletList';
import Wallet from '../../../../models/wallet';
import createDebug from 'debug';

const walletDeleteComposer = new Composer<MyContext>();

const debug = createDebug('bot:wallet:delete');

walletDeleteComposer.callbackQuery('wallet_delete_address', async (ctx) => {
  debug('wallet_delete_address');

  await handleWalletList(ctx, 1, true);
});

walletDeleteComposer.callbackQuery(/delete_([a-f0-9]{24})$/, async (ctx) => {
  const walletId = ctx.callbackQuery.data.split('_')[1];

  debug('delete_wallet', walletId);

  await Wallet.findByIdAndUpdate(walletId, {
    isOnline: true,
  });

  await ctx.reply('✅ 删除成功');

  await handleWalletList(ctx, 1, true);
});

export default walletDeleteComposer;
