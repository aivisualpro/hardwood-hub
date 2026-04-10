import { connectDB } from './server/utils/mongoose';
import { Customer } from './server/models/Customer';

async function run() {
  await connectDB();
  const res = await Customer.updateMany(
    { tags: { $nin: ['subscribers'] } },
    { $pull: { tags: 'subscribers' } } // Remove then push to avoid duplicates, although we did nin, let's change logic
  );
  console.log("Cleared old state");
  
  const res2 = await Customer.updateMany(
    { tags: { $ne: 'subscribers' } },
    { $push: { tags: 'subscribers' } }
  );
  console.log('Update result:', res2);
  process.exit(0);
}

run().catch(console.error);
