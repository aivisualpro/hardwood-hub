import mongoose from 'mongoose';

const URI = process.env.MONGODB_URI || "mongodb://localhost:27017/test"; // Oh we don't have .env! Let's just find out what mongoose throws.
