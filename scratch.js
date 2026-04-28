const res = await fetch("http://localhost:3000/api/app-settings");
const json = await res.json();
console.log(JSON.stringify(json.data.companyProfile.signature, null, 2));
