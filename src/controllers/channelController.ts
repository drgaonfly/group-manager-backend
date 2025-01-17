import { Request, Response } from 'express';
import Channel from '../models/channel';
import handleAsync from '../utils/handleAsync';
import QRCode from 'qrcode';

// Helper function to build query
const buildChannelQuery = (queryParams: any): any => {
  const query: any = {};

  if (queryParams.agent) {
    query.agent = queryParams.agent;
  }

  if (queryParams.status !== undefined) {
    query.status = queryParams.status === 'true';
  }

  return query;
};

// Get all channels
const getChannels = handleAsync(async (req: Request, res: Response) => {
  const { current = '1', pageSize = '10' } = req.query;

  const query = buildChannelQuery(req.query);

  const channels = await Channel.find(query)
    .populate('user')
    .sort('-createdAt')
    .skip((+current - 1) * +pageSize)
    .limit(+pageSize)
    .exec();

  const total = await Channel.countDocuments(query).exec();

  res.json({
    success: true,
    data: channels,
    total,
    current: +current,
    pageSize: +pageSize,
  });
});

// Add a new channel
const addChannel = handleAsync(async (req: Request, res: Response) => {
  const newChannel = new Channel({
    ...req.body,
  });

  const savedChannel = await newChannel.save();

  res.json({
    success: true,
    data: savedChannel,
  });
});

// Get channel by ID and generate QR code
const getChannelById = handleAsync(async (req: Request, res: Response) => {
  const channel = await Channel.findById(req.params.id).populate('agent');

  if (!channel) {
    res.status(404);
    throw new Error('Channel not found');
  }

  const qrCodeUrl = await QRCode.toDataURL(channel.code);

  res.json({
    success: true,
    data: channel,
    qrCode: qrCodeUrl,
  });
});

// Update channel
const updateChannel = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updatedChannel = await Channel.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true },
  ).populate('agent');

  if (!updatedChannel) {
    res.status(404);
    throw new Error('Channel not found');
  }

  res.json({
    success: true,
    data: updatedChannel,
  });
});

// Delete channel
const deleteChannel = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const channel = await Channel.findByIdAndDelete(id);

  if (!channel) {
    res.status(404);
    throw new Error('Channel not found');
  }

  res.json({
    success: true,
    data: { message: 'Channel deleted successfully' },
  });
});

// Batch delete channels
const deleteMultipleChannels = handleAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    await Channel.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: `${ids.length} channels deleted successfully`,
    });
  },
);

export {
  getChannels,
  addChannel,
  getChannelById,
  updateChannel,
  deleteChannel,
  deleteMultipleChannels,
};
