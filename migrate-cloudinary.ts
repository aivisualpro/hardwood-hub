import { v2 as oldCloudinary } from 'cloudinary'
import { v2 as newCloudinary } from 'cloudinary'
import mongoose from 'mongoose'

oldCloudinary.config({
  cloud_name: 'dfhmut9lf',
  api_key: '892774349659755',
  api_secret: 'wollksuLbhMwcEGp-CsQe2lh7gc'
});

newCloudinary.config({
  cloud_name: 'dy5kws4pr',
  api_key: '342792283338181',
  api_secret: '7sgT7WFnIxtjLdJjLXOfj_O6U24'
});

async function migrateImages() {
   let next_cursor: string | undefined = undefined;
   let totalCount = 0;
   do {
       const res: any = await oldCloudinary.api.resources({ type: 'upload', max_results: 100, next_cursor });
       for (const resource of res.resources) {
            console.log(`Migrating image: ${resource.secure_url}`);
            try {
              await newCloudinary.uploader.upload(resource.secure_url, {
                 public_id: resource.public_id,
                 resource_type: 'auto',
                 overwrite: true
              });
              totalCount++;
            } catch (e: any) { 
              console.error(`Error uploading ${resource.secure_url}:`, e?.message || e);
            }
       }
       next_cursor = res.next_cursor;
   } while(next_cursor);
   console.log(`Migrated ${totalCount} images.`);
}

const MONGODB_URI = 'mongodb+srv://adeel:Stp8e23BuXPTBemF@bookingx.qni27fu.mongodb.net/hardwoodDB';

async function updateDatabase() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;
    
    if (!db) {
       console.error("DB connection failed");
       return;
    }

    const collections = await db.collections();
    let totalUpdated = 0;
    
    for (const collection of collections) {
       console.log(`Processing collection: ${collection.collectionName}`);
       const docs = await collection.find({}).toArray();
       
       let colUpdated = 0;
       for (const doc of docs) {
            const str = JSON.stringify(doc);
            if (str.includes('dfhmut9lf')) {
                const newStr = str.replace(/dfhmut9lf/g, 'dy5kws4pr');
                const newDoc = JSON.parse(newStr);
                const id = doc._id;
                delete newDoc._id; // avoid modifying immutable _id
                
                await collection.updateOne({ _id: id }, { $set: newDoc });
                colUpdated++;
                totalUpdated++;
            }
       }
       if (colUpdated > 0) {
         console.log(`Updated ${colUpdated} documents in ${collection.collectionName}`);
       }
    }
    console.log(`Done DB sync. Total documents updated: ${totalUpdated}`);
}

async function run() {
  try {
    console.log("Starting Image Migration...");
    await migrateImages();
    console.log("\nStarting Database Migration...");
    await updateDatabase();
    console.log("\nAll Done!");
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
