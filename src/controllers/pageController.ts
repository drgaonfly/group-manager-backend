import { Request, Response } from 'express';

import handleAsync from '../utils/handleAsync';
import Question from '../models/question';
import Video from '../models/video';
import Partnership from '../models/partnership';
import { transformDocumentImages } from '../utils/transformUtils';

// 获取所有页面
export const getHome = handleAsync(async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Hello World',
  });
});

// 获取服务页面
export const getServe = handleAsync(async (req: Request, res: Response) => {
  const { lang } = req.query;

  const [faqData, videoData, partnershipData] = await Promise.all([
    // Get FAQ data
    Question.find(lang ? { lang } : {}).sort('-createdAt'),

    // Get latest video
    Video.findOne().sort({ createdAt: -1 }).select('url'),

    // Get partnerships
    Partnership.find().sort('-createdAt'),
  ]);

  // Process video URL if exists
  const processedVideo = videoData
    ? (await transformDocumentImages([videoData], ['url']))[0]
    : null;

  // Process partnership logos
  const processedPartnerships = await transformDocumentImages(partnershipData, [
    'logoUrl',
  ]);

  res.json({
    success: true,
    data: {
      faq: {
        data: faqData,
      },
      video: processedVideo?.url,
      partnerships: {
        data: processedPartnerships,
      },
    },
  });
});
