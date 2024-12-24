import { Request, Response } from 'express';
import Record from '../models/record';
import handleAsync from '../utils/handleAsync';
import { exclude } from '../utils/handleData';

export const getRecords = handleAsync(async (req: Request, res: Response) => {
  const records = await Record.find().populate('user topic').exec();
  res.json({
    success: true,
    data: records,
  });
});

export const addRecord = handleAsync(async (req: Request, res: Response) => {
  const { user, topic, answer } = req.body;
  const newRecord = new Record({ user, topic, answer });
  const savedRecord = await newRecord.save();
  res.json({
    success: true,
    data: exclude(savedRecord.toObject(), '__v'),
  });
});

export const getRecordById = handleAsync(
  async (req: Request, res: Response) => {
    const record = await Record.findById(req.params.id).populate('user topic');
    if (!record) {
      res.status(404);
      throw new Error('Record not found');
    }
    res.json({
      success: true,
      data: exclude(record.toObject(), '__v'),
    });
  },
);

export const updateRecord = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updatedRecord = await Record.findByIdAndUpdate(id, req.body, {
    new: true,
  });
  if (!updatedRecord) {
    res.status(404);
    throw new Error('Record not found');
  }
  res.json({
    success: true,
    data: exclude(updatedRecord.toObject(), '__v'),
  });
});

export const deleteRecord = handleAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const record = await Record.findByIdAndDelete(id);
  if (!record) {
    res.status(404);
    throw new Error('Record not found');
  }
  res.json({
    success: true,
    data: { message: 'Record deleted successfully' },
  });
});
