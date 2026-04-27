import { v2 as cloudinary } from 'cloudinary'
import fs from 'fs'
import crypto from 'crypto'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const size = 12 * 1024 * 1024; // 12MB
const buffer = crypto.randomBytes(size);
const tmpPath = '/tmp/test-large-file.pdf';
fs.writeFileSync(tmpPath, buffer);

console.log('Testing upload_large...')
cloudinary.uploader.upload_large(tmpPath, {
  folder: 'hardwood-hub/test',
  resource_type: 'raw',
  chunk_size: 6000000
}, (error, result) => {
  if (error) {
    console.error('Failed:', error.message);
  } else {
    console.log('Success:', result.secure_url);
  }
});
