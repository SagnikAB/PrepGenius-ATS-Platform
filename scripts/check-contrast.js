const fs = require('fs');
const path = require('path');

function parseVars(block) {
  const vars = {};
  const re = /--([\w-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(block))) vars[m[1]] = m[2].trim();
  return vars;
}

function parseColor(s) {
  s = s.trim();
  if (s.startsWith('rgba')) {
    const nums = s.replace(/rgba?\(|\)/g, '').split(',').map(n=>parseFloat(n.trim()));
    return { r: nums[0], g: nums[1], b: nums[2], a: nums[3] ?? 1 };
  }
  if (s.startsWith('rgb')) {
    const nums = s.replace(/rgb?\(|\)/g, '').split(',').map(n=>parseFloat(n.trim()));
    return { r: nums[0], g: nums[1], b: nums[2], a: 1 };
  }
  if (s.startsWith('#')) {
    let hex = s.slice(1);
    if (hex.length === 3) hex = hex.split('').map(h=>h+h).join('');
    const num = parseInt(hex,16);
    return { r: (num>>16)&255, g: (num>>8)&255, b: num&255, a:1 };
  }
  return null;
}

function lum(c) {
  const srgb = [c.r/255, c.g/255, c.b/255].map(v => v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4));
  return 0.2126*srgb[0] + 0.7152*srgb[1] + 0.0722*srgb[2];
}

function contrast(a,b) {
  const La = lum(a);
  const Lb = lum(b);
  const l1 = Math.max(La,Lb);
  const l2 = Math.min(La,Lb);
  return (l1+0.05)/(l2+0.05);
}

const css = fs.readFileSync(path.join(__dirname,'..','app','globals.css'),'utf8');

function getBlock(selector) {
  const re = new RegExp(selector.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&') + '\\s*\\{([\\s\\S]*?)\\}');
  const m = css.match(re);
  return m ? m[1] : '';
}

const themes = {
  default: parseVars(getBlock(':root')),
  light: parseVars(getBlock(':root[data-theme="light"]')),
  dark: parseVars(getBlock(':root[data-theme="dark"]')),
};

const pairs = [
  ['card-foreground','card-bg'],
  ['card-muted','card-bg'],
  ['text-primary','bg'],
  ['accent-text','bg'],
  ['accent-primary','bg'],
];

for (const [name,vars] of Object.entries(themes)) {
  console.log('\nTheme:', name);
  for (const [a,b] of pairs) {
    const ca = vars[a] || themes.default[a];
    const cb = vars[b] || themes.default[b];
    const pa = parseColor(ca || '');
    const pb = parseColor(cb || '');
    if (!pa || !pb) {
      console.log(` - ${a} vs ${b}: missing (${ca} / ${cb})`);
      continue;
    }
    const cr = contrast(pa,pb);
    const passAA = cr >= 4.5;
    const passLarge = cr >= 3.0;
    console.log(` - ${a} vs ${b}: ${cr.toFixed(2)} (AA=${passAA}, Large=${passLarge})`);
  }
}

console.log('\nNote: comparisons use raw CSS colors defined in app/globals.css.');
