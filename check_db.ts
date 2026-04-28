import { connectDB } from './server/utils/mongoose';
import { AppSetting } from './server/models/AppSetting';

async function run() {
  await connectDB();
  const doc = await AppSetting.findOne({ key: 'companyProfile' }).lean();
  console.log("DB Content:", JSON.stringify(doc?.value?.signature, null, 2));
  process.exit(0);
}
run();
