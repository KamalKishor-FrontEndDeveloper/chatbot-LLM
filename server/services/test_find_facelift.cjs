const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'api_data.json');
// Read as buffer and detect encoding
const buf = fs.readFileSync(dataPath);
// Debug: print first 200 bytes as hex
const hex = buf.slice(0,200).toString('hex');
console.log('First 200 bytes hex:', hex);
let raw;
if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
  // UTF-8 with BOM
  raw = buf.toString('utf8').slice(1);
} else if (buf[0] === 0xFF && buf[1] === 0xFE) {
  // UTF-16 LE
  raw = buf.toString('utf16le');
} else {
  // Try UTF-8 first, fallback to UTF-16LE
  try {
    raw = buf.toString('utf8');
    JSON.parse(raw);
  } catch (e) {
    raw = buf.toString('utf16le');
    // Trim anything before the first JSON object start
    const firstBrace = raw.indexOf('{');
    if (firstBrace > 0) raw = raw.slice(firstBrace);
  }
}
let json;
try {
  json = JSON.parse(raw);
} catch (err) {
  console.error('Failed to parse api_data.json:', err.message);
  process.exit(1);
}

const treatments = [];
function flatten(nodes) {
  if (!nodes) return;
  for (const n of nodes) {
    treatments.push(n);
    if (n.children) flatten(n.children);
  }
}
flatten(json.data);

function normalize(s){
  if(!s) return '';
  return s.toLowerCase().replace(/[.,!?()\-\/\\]/g, ' ').replace(/\s+/g, ' ').trim();
}
function compact(s){ return normalize(s).replace(/\s+/g, ''); }

const aliases = {
  'facelift': ['anti wrinkle injection','dermal filler','hifu','botox','face lift','face-lift']
};

const queries = [
  'facelift',
  'What is the cost of facelift?',
  'cost of face lift'
];

for(const q of queries){
  const nQ = normalize(q);
  const cQ = compact(q);
  let found = null;
  for(const t of treatments){
    const nT = normalize(t.t_name);
    const cT = compact(t.t_name);
    if(nQ === nT || cQ === cT) { found = t; break; }
    // alias match
    for(const [k,vals] of Object.entries(aliases)){
      if(cQ === compact(k) || vals.map(compact).includes(cQ)){
        if(compact(k) === cT || vals.map(compact).includes(cT) || cT.includes(compact(k))){ found = t; break; }
      }
    }
    if(found) break;
  }
  console.log('Query:', q);
  if(found){
    console.log('Matched:', found.t_name);
    console.log('Price:', found.price);
    console.log('Doctors:', found.doctors);
  } else {
    console.log('No match');
  }
  console.log('---');
}
