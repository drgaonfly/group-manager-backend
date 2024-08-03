import {Request} from "express"
import {IMenu} from "../models/menu";

export interface RequestCustom extends Request
{
  menu?: IMenu;
}
