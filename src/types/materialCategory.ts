import {Request} from "express"
import {IMaterialCategory} from "../models/materialCategory";

export interface RequestCustom extends Request
{
  materialCategory?: IMaterialCategory;
}
