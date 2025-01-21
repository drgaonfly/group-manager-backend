import { Model, FilterQuery } from 'mongoose';

export class IdGen {
  static async next<T>(
    model: Model<T>,
    field: keyof T,
    padLength: number = 10,
  ): Promise<string> {
    const sortQuery = { [field]: -1 } as any;
    const sortedDocs = await model.find().sort(sortQuery);

    const validDocs = sortedDocs.filter(
      (doc) => !isNaN(Number((doc as any)[field])),
    );

    let maxNumber = 0;
    if (validDocs.length > 0) {
      maxNumber = Math.max(
        ...validDocs.map((doc) => Number((doc as any)[field])),
      );
    }

    let newId;
    do {
      newId = (maxNumber + 1).toString().padStart(padLength, '0');
      maxNumber++;
    } while (await model.exists({ [field]: newId } as FilterQuery<T>));

    return newId;
  }
}
