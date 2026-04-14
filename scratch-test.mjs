import fs from 'fs';
import { Buffer } from 'buffer';

const envFile = fs.readFileSync('.env', 'utf8');
const tokenMatch = envFile.match(/CALENDLY_ACCESS_TOKEN=(.+)/);
if (!tokenMatch) {
  console.log("No token found");
  process.exit(1);
}
const token = tokenMatch[1].trim();
const parts = token.split('.');
console.log("parts:", parts.length);
const payloadStr = Buffer.from(parts[1], 'base64').toString('utf-8');
const payload = JSON.parse(payloadStr);

console.log("User UUID:", payload.user_uuid);

const userUri = `https://api.calendly.com/users/${payload.user_uuid}`;
console.log("User URI:", userUri);

const res = await fetch(`https://api.calendly.com/scheduled_events?user=${encodeURIComponent(userUri)}&status=active`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
console.log("Events Status:", res.status);
const data = await res.json();
console.log("Events:", data.collection?.length);
