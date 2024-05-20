import User from '../models/user';
import setupDB from "./db";
import bcrypt from "bcrypt";
import mongoose from 'mongoose';
import {ROLES} from "../constants";

const seedUsers = [
  { email: 'superadmin@2024fc.xyz', password: 'superadmin2024', role: ROLES.SuperAdmin, name: 'Super Admin' },
  { email: 'customer@2024fc.xyz', password: 'customer2024', role: ROLES.Customer, name: 'Customer' },
  { email: 'orderclerk@2024fc.xyz', password: 'orderclerk2024', role: ROLES.OrderClerk, name: 'Order Clerk' },
  { email: 'finance@2024fc.xyz', password: 'finance2024', role: ROLES.FinancialStaff, name: 'Financial Staff' },
  { email: 'user@2024fc.xyz', password: 'password123', name: 'General User' }, // A user without a specified role defaults to a general user role, if applicable
  { email: 'admin@2024fc.xyz', password: 'password123', role: ROLES.Admin, name: 'Admin' }, // A user without a specified role defaults to a general user role, if applicable
  { email: 'newuser@2024fc.xyz', password: 'newuser2024', name: 'New User' }, // Add a new user with name 'New User'
];

const createUsers = async (): Promise<void> => {
  try {

    setupDB()

    for (const user of seedUsers) {
      const hashedPassword = await bcrypt.hash(user.password, 12);
      await User.create({ email: user.email, password: hashedPassword, role: user.role, name: user.name });
    }

    console.log('All users have been created successfully!');
  } catch (err) {
    console.error('Error creating users:', err);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB Disconnected');
  }
};

createUsers();
