import cloudinary from 'cloudinary'
import mongoose from 'mongoose'

// We will fetch from old account first, store in memory, then configure new account and upload.

// 1. OLD ACCOUNT CONFIG
cloudinary.v2.config({
  cloud_name: 'dfhmut9lf',
  api_key: '892774349659755',
  api_secret: 'wollksuLbhMwcEGp-CsQe2lh7gc'
});

async function getOldImages() {
   console.log("Fetching images from old account (dfhmut9lf)...");
   let next_cursor: string | undefined = undefined;
   const oldImages: any[] = [];
   do {
       const res: any = await cloudinary.v2.api.resources({ type: 'upload', max_results: 500, next_cursor });
       for (const resource of res.resources) {
            oldImages.push(resource);
       }
       next_cursor = res.next_cursor;
   } while(next_cursor);
   console.log(`Found ${oldImages.length} images in old account.`);
   return oldImages;
}

async function run() {
  try {
    const oldImages = await getOldImages();

    // 2. NEW ACCOUNT CONFIG
    console.log("\nConfiguring new account (dy5kws4pr)...");
    cloudinary.v2.config({
      cloud_name: 'dy5kws4pr',
      api_key: '342792283338181',
      api_secret: '7sgT7WFnIxtjLdJjLXOfj_O6U24'
    });

    console.log("Starting Migration to new account...");
    let totalCount = 0;
    for (const resource of oldImages) {
        console.log(`Migrating image: ${resource.public_id}...`);
        try {
          await cloudinary.v2.uploader.upload(resource.secure_url, {
             public_id: resource.public_id,
             resource_type: 'auto',
             overwrite: true
          });
          totalCount++;
        } catch (e: any) { 
          console.error(`Error uploading ${resource.secure_url}:`, e?.message || e);
        }
    }
    console.log(`Successfully migrated ${totalCount} images to new account.`);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
