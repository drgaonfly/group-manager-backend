import { Request, Response } from 'express';

import handleAsync from '../utils/handleAsync';
import Question from '../models/question';
import Video from '../models/video';
import Partnership from '../models/partnership';
import { transformDocumentImages } from '../utils/transformUtils';
import Notice from '../models/notice';
import MiningOutput from '../models/miningOutput';
import RegulationAgency from '../models/regulationAgency';
import Carousel from '../models/carousel';
import Feature from '../models/feature';

// 获取所有页面
export const getHome = handleAsync(async (req: Request, res: Response) => {
  const { lang } = req.query;

  const [
    faqData,
    notices,
    miningOutputs,
    partnerships,
    regulationAgencies,
    carousels,
  ] = await Promise.all([
    // Get FAQ data
    Question.find(lang ? { lang } : {}).sort('-createdAt'),

    // Get notices
    Notice.find().sort('-createdAt'),

    // Get mining outputs
    MiningOutput.aggregate([{ $sample: { size: 50 } }]),

    // Get partnerships
    Partnership.find().sort('-createdAt'),

    // Get regulation agencies
    RegulationAgency.find().sort('-createdAt'),

    // Get carousels
    Carousel.find().sort('-createdAt').select('image'),
  ]);

  // Process carousel images, partnership logos and regulation agency logos
  const [
    processedCarousels,
    processedPartnerships,
    processedRegulationAgencies,
  ] = await Promise.all([
    transformDocumentImages(carousels, ['image']),
    transformDocumentImages(partnerships, ['logoUrl']),
    transformDocumentImages(regulationAgencies, ['logoUrl']),
  ]);

  res.json({
    success: true,
    data: {
      faq: faqData,
      notices,
      miningOutputs,
      partnerships: processedPartnerships,
      regulationAgencies: processedRegulationAgencies,
      carousels: processedCarousels,
    },
  });
});

// 获取服务页面
export const getServe = handleAsync(async (req: Request, res: Response) => {
  const { lang, type } = req.query;

  const [faqData, featureData, videoData, partnershipData] = await Promise.all([
    // Get FAQ data
    Question.find(lang ? { lang } : {}).sort('-createdAt'),

    // Get features data
    Feature.find({
      ...(lang ? { lang } : {}),
      ...(type ? { type } : {}),
    }).sort('-createdAt'),

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
      features: {
        data: featureData,
      },
      video: processedVideo?.url,
      partnerships: {
        data: processedPartnerships,
      },
    },
  });
});

// 获取服务页面
export const getInvite = handleAsync(async (req: Request, res: Response) => {
  const { lang, type } = req.query;

  const [featureData] = await Promise.all([
    // Get features data
    Feature.find({
      ...(lang ? { lang } : {}),
      ...(type ? { type } : {}),
    }).sort('-createdAt'),
  ]);

  res.json({
    success: true,
    data: {
      features: {
        data: featureData,
      },
    },
  });
});
