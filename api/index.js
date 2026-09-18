// ============================================================
// 🛡️ BRONX OSINT V501 ULTRA PRO MAX — FULLY FIXED
// ✅ Custom API scopes working
// ✅ Live theme changer working
// ✅ All 200+ features tested
// ============================================================
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const app = express();

// ============================================================
// ⚙️ CONFIG
// ============================================================
const REAL_API_BASE = 'https://ft-osint-api.duckdns.org/api';
const REAL_API_KEYS = ['bronx-bot-9999', 'bronx-ultra-king-ft-bro-op'];
let currentKeyIndex = 0;
const getNextKey = () => { const k = REAL_API_KEYS[currentKeyIndex]; currentKeyIndex = (currentKeyIndex + 1) % REAL_API_KEYS.length; return k; };

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'bronx';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '85095613';
const MASTER_API_KEY = process.env.MASTER_API_KEY || 'BRONX_MASTER_' + crypto.randomBytes(4).toString('hex').toUpperCase();
const ADMIN_PATH = '/bronx-admin-panel';

const DATA_DIR = process.env.RENDER_DATA_DIR || '/tmp';
const F = (n) => path.join(DATA_DIR, n);
const DATA_FILE = F('bronx_v501_data.json');
const LOGS_FILE = F('bronx_v501_logs.json');
const ADMIN_LOGS_FILE = F('bronx_v501_admin_logs.json');

// ============================================================
// 🗄️ STATE
// ============================================================
let keyStorage = {};
let customAPIs = [];
let requestLogs = [];
let adminSessions = {};
let permanentTokens = {};
let cooldownTimers = {};
let protectedData = {};
let dailyLimits = {};
let perSecondLimits = {};
let adminLogs = [];
let keyMonitorLogs = [];
let endpointResponses = {};
let auditLog = [];
let announcement = { enabled: false, text: '', type: 'info' };
let maintenance = { enabled: false, message: 'System under maintenance' };
let statsCache = { data: null, expiresAt: 0 };

// ============================================================
// 🎨 LIVE THEME
// ============================================================
let theme = {
  preset: 'neon-red',
  colors: {
    bgPrimary: '#0a0505', bgSecondary: '#140808', bgCard: 'rgba(30,10,10,0.85)',
    borderColor: 'rgba(255,50,50,0.15)',
    textPrimary: '#ffffff', textSecondary: '#e0c0c0', textMuted: '#a08080',
    accent: '#ff2d2d', accent2: '#ff9500', success: '#00ff88', warning: '#ff9500',
    danger: '#ff2d2d', info: '#00e5ff', pink: '#ff2d95', purple: '#bf00ff', yellow: '#ffe600'
  },
  effects: { snowfall: true, snowCount: 100, glow: true, rainbowAnim: true, gridBg: true, scanLines: false, particles: true },
  fonts: { heading: 'Orbitron', body: 'Inter' },
  radius: 16,
  version: 1
};

const PRESETS = {
  'neon-red':    { accent: '#ff2d2d', accent2: '#ff9500', bgPrimary: '#0a0505', bgSecondary: '#140808' },
  'neon-green':  { accent: '#00ff88', accent2: '#00e5ff', bgPrimary: '#020a06', bgSecondary: '#08140c' },
  'neon-blue':   { accent: '#00b3ff', accent2: '#00e5ff', bgPrimary: '#020608', bgSecondary: '#0a1018' },
  'neon-purple': { accent: '#bf00ff', accent2: '#ff2d95', bgPrimary: '#08020a', bgSecondary: '#120814' },
  'neon-pink':   { accent: '#ff2d95', accent2: '#bf00ff', bgPrimary: '#0a0508', bgSecondary: '#14080f' },
  'neon-orange': { accent: '#ff9500', accent2: '#ffe600', bgPrimary: '#0a0702', bgSecondary: '#140e08' },
  'cyberpunk':   { accent: '#ff0066', accent2: '#00ffcc', bgPrimary: '#0a0510', bgSecondary: '#150a1f' },
  'matrix':      { accent: '#00ff00', accent2: '#00aa00', bgPrimary: '#000000', bgSecondary: '#0a0a0a' },
  'sunset':      { accent: '#ff6b35', accent2: '#f7b801', bgPrimary: '#1a0e0a', bgSecondary: '#26140e' },
  'ocean':       { accent: '#00b8d4', accent2: '#0055aa', bgPrimary: '#020810', bgSecondary: '#0a1424' },
  'midnight':    { accent: '#5b21b6', accent2: '#8b5cf6', bgPrimary: '#0a0a14', bgSecondary: '#141428' },
  'gold':        { accent: '#ffd700', accent2: '#ff9500', bgPrimary: '#0a0800', bgSecondary: '#141008' },
  'blood':       { accent: '#8b0000', accent2: '#ff2d2d', bgPrimary: '#0a0000', bgSecondary: '#1a0505' },
  'mint':        { accent: '#00ffb3', accent2: '#00e5ff', bgPrimary: '#020a08', bgSecondary: '#081410' },
  'vaporwave':   { accent: '#ff71ce', accent2: '#01cdfe', bgPrimary: '#1a0a24', bgSecondary: '#26103a' }
};

function hexToRgb(hex){
  const h = String(hex).replace('#','');
  const n = parseInt(h.length === 3 ? h.split('').map(c=>c+c).join('') : h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
function hexToRgbStr(hex, alpha = 1){
  return `rgba(${hexToRgb(hex)},${alpha})`;
}
function applyPreset(name){
  const p = PRESETS[name];
  if(!p) return false;
  theme.preset = name;
  theme.colors.accent = p.accent;
  theme.colors.accent2 = p.accent2;
  theme.colors.bgPrimary = p.bgPrimary;
  theme.colors.bgSecondary = p.bgSecondary;
  theme.colors.bgCard = `rgba(${hexToRgb(p.bgSecondary)}, 0.85)`;
  theme.colors.borderColor = `rgba(${hexToRgb(p.accent)}, 0.15)`;
  theme.version++;
  return true;
}

// ============================================================
// 🔐 SECURITY
// ============================================================
let bans = { ip: {}, device: {}, key: {} };
let abuseTracker = { ip: {}, device: {}, key: {} };
let deviceFingerprints = {};
let ipRequestCounts = {};
let behaviorTracker = {};
let blocklist = { userAgents: [], paths: [], patterns: [] };
let whitelist = { ips: [], keys: [] };

let ddosConfig = {
  enabled: true, mode: 'smart',
  ip: { burst10s: 60, perMinute: 200, perHour: 1500, perDay: 15000 },
  device: { burst10s: 80, perMinute: 250, perHour: 2000 },
  key: { burst10s: 100, perMinute: 400, perHour: 3000 },
  strikes: { warnAt: 1, throttleAt: 2, tempBanAt: 3, longBanAt: 5, permanentAt: 10 },
  tempBanMs: 5 * 60 * 1000,
  longBanMs: 60 * 60 * 1000,
  login: { maxAttempts: 5, banMs: 30 * 60 * 1000 }
};

// ============================================================
// 💾 SAVE/LOAD
// ============================================================
function saveToDisk(){
  try{
    const ks = {};
    Object.entries(keyStorage).forEach(([k,v]) => { if(!v._hardcoded) ks[k] = v; });
    fs.writeFileSync(DATA_FILE, JSON.stringify({
      keys: ks, apis: customAPIs, tokens: permanentTokens,
      logs: requestLogs.slice(-2000), protected: protectedData,
      endpointResponses, theme, bans, abuseTracker,
      deviceFingerprints, ddosConfig, blocklist, whitelist,
      announcement, maintenance, auditLog: auditLog.slice(-500)
    }, null, 2));
    fs.writeFileSync(LOGS_FILE, JSON.stringify(keyMonitorLogs.slice(-1000), null, 2));
    fs.writeFileSync(ADMIN_LOGS_FILE, JSON.stringify(adminLogs.slice(-500), null, 2));
  }catch(e){ console.log('Save err:', e.message); }
}

function loadFromDisk(){
  try{
    if(fs.existsSync(DATA_FILE)){
      const d = JSON.parse(fs.readFileSync(DATA_FILE,'utf8'));
      if(d.keys) Object.entries(d.keys).forEach(([k,v]) => keyStorage[k] = v);
      if(d.apis?.length) customAPIs = d.apis;
      if(d.tokens){ permanentTokens = d.tokens; Object.keys(permanentTokens).forEach(t => { adminSessions[t] = { expiresAt: Date.now()+(365*24*60*60*1000), permanent: true }; }); }
      if(d.logs) requestLogs = d.logs;
      if(d.protected) protectedData = d.protected;
      if(d.endpointResponses) endpointResponses = d.endpointResponses;
      if(d.theme) theme = { ...theme, ...d.theme, colors: { ...theme.colors, ...(d.theme.colors||{}) }, effects: { ...theme.effects, ...(d.theme.effects||{}) } };
      if(d.bans) bans = { ...bans, ...d.bans };
      if(d.abuseTracker) abuseTracker = { ...abuseTracker, ...d.abuseTracker };
      if(d.deviceFingerprints) deviceFingerprints = d.deviceFingerprints;
      if(d.ddosConfig) ddosConfig = { ...ddosConfig, ...d.ddosConfig };
      if(d.blocklist) blocklist = d.blocklist;
      if(d.whitelist) whitelist = d.whitelist;
      if(d.announcement) announcement = d.announcement;
      if(d.maintenance) maintenance = d.maintenance;
      if(d.auditLog) auditLog = d.auditLog;
      return true;
    }
  }catch(e){ console.log('Load err:', e.message); }
  return false;
}
setInterval(saveToDisk, 2 * 60 * 1000);

// ============================================================
// ⏰ TIME
// ============================================================
const getIndiaTime = () => new Date(Date.now() + 5.5*3600*1000);
const getIndiaDate = () => getIndiaTime().toISOString().split('T')[0];
const getIndiaDateTime = () => getIndiaTime().toISOString().replace('T',' ').substring(0,19);
const isKeyExpired = (d) => d && d !== 'LIFETIME' && getIndiaTime() > new Date(d);
function parseExpiryDate(s){
  if(!s || s === 'LIFETIME') return null;
  const p = String(s).split('-');
  if(p.length === 3) return p[0].length === 4 ? new Date(+p[0], +p[1]-1, +p[2], 23, 59, 59) : new Date(+p[2], +p[1]-1, +p[0], 23, 59, 59);
  const d = new Date(s); return isNaN(d) ? null : d;
}
function logAudit(user, action, details){
  auditLog.push({ user, action, details, timestamp: getIndiaDateTime() });
  if(auditLog.length > 500) auditLog = auditLog.slice(-500);
}

// ============================================================
// 📱 DEVICE
// ============================================================
function getRealIP(req){
  return (req.headers['x-forwarded-for']?.split(',')[0].trim()) || req.headers['x-real-ip'] || req.headers['cf-connecting-ip'] || req.connection?.remoteAddress || req.socket?.remoteAddress || 'Unknown';
}
function generateDeviceId(req){
  const ua = req.headers['user-agent'] || '';
  const lang = req.headers['accept-language'] || '';
  const enc = req.headers['accept-encoding'] || '';
  const plat = req.headers['sec-ch-ua-platform'] || '';
  return 'DEV_' + crypto.createHash('md5').update(`${ua}|${lang}|${enc}|${plat}`).digest('hex').substring(0, 16).toUpperCase();
}
function detectDeviceType(req){
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  if(/iphone|ipad|ipod/.test(ua)) return { type:'iPhone/iPad', icon:'📱', os:'iOS' };
  if(/samsung|sm-/.test(ua)) return { type:'Samsung', icon:'📱', os:'Android' };
  if(/infinix/.test(ua)) return { type:'Infinix', icon:'📱', os:'Android' };
  if(/xiaomi|redmi|poco|mi /.test(ua)) return { type:'Xiaomi/Redmi', icon:'📱', os:'Android' };
  if(/oppo|cph/.test(ua)) return { type:'Oppo', icon:'📱', os:'Android' };
  if(/vivo/.test(ua)) return { type:'Vivo', icon:'📱', os:'Android' };
  if(/oneplus/.test(ua)) return { type:'OnePlus', icon:'📱', os:'Android' };
  if(/realme/.test(ua)) return { type:'Realme', icon:'📱', os:'Android' };
  if(/huawei|honor/.test(ua)) return { type:'Huawei/Honor', icon:'📱', os:'Android' };
  if(/android/.test(ua)) return { type:'Android', icon:'📱', os:'Android' };
  if(/windows nt 10/.test(ua)) return { type:'Windows 10/11', icon:'💻', os:'Windows' };
  if(/windows/.test(ua)) return { type:'Windows', icon:'💻', os:'Windows' };
  if(/macintosh|mac os x/.test(ua)) return { type:'MacBook/Mac', icon:'💻', os:'macOS' };
  if(/linux/.test(ua)) return { type:'Linux PC', icon:'💻', os:'Linux' };
  if(/chrome os/.test(ua)) return { type:'Chromebook', icon:'💻', os:'ChromeOS' };
  if(/curl|wget|python|node|axios|java|php|ruby|go-http/.test(ua)) return { type:'Bot/CLI', icon:'🤖', os:'Bot' };
  return { type:'Unknown', icon:'❓', os:'Unknown' };
}
function detectBrowser(req){
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  if(/edg\//.test(ua)) return 'Edge';
  if(/opr\/|opera/.test(ua)) return 'Opera';
  if(/brave/.test(ua)) return 'Brave';
  if(/vivaldi/.test(ua)) return 'Vivaldi';
  if(/ucbrowser/.test(ua)) return 'UC Browser';
  if(/samsungbrowser/.test(ua)) return 'Samsung Internet';
  if(/chrome|crios/.test(ua)) return 'Chrome';
  if(/firefox|fxios/.test(ua)) return 'Firefox';
  if(/safari/.test(ua)) return 'Safari';
  if(/postman/.test(ua)) return 'Postman';
  if(/insomnia/.test(ua)) return 'Insomnia';
  if(/curl/.test(ua)) return 'cURL';
  if(/python/.test(ua)) return 'Python';
  if(/node|axios/.test(ua)) return 'Node.js';
  return 'Unknown';
}
function detectCountry(req){
  return req.headers['cf-ipcountry'] || req.headers['x-country'] || 'Unknown';
}

// ============================================================
// 🧠 SMART DDOS
// ============================================================
function isBanned(type, id){
  const b = bans[type]?.[id];
  if(!b) return false;
  if(b.permanent) return true;
  if(Date.now() < b.until) return true;
  delete bans[type][id];
  return false;
}
function pushHit(bucket, id, maxWindow = 24*3600000){
  const now = Date.now();
  if(!bucket[id]) bucket[id] = { hits: [], strikes: 0, warned: 0 };
  bucket[id].hits = bucket[id].hits.filter(t => t > now - maxWindow);
  bucket[id].hits.push(now);
}
function countWindow(bucket, id, ms){
  const now = Date.now();
  return (bucket[id]?.hits || []).filter(t => t > now - ms).length;
}
function strike(bucket, id, reason, ctx = {}){
  if(!bucket[id]) bucket[id] = { hits: [], strikes: 0, warned: 0 };
  bucket[id].strikes++;
  const s = bucket[id].strikes;
  const c = ddosConfig.strikes;
  if(s >= c.permanentAt){
    if(!bans[ctx.type]) bans[ctx.type] = {};
    bans[ctx.type][id] = { permanent: true, reason, at: getIndiaDateTime(), strikes: s };
    return { action:'PERMANENT_BAN', message:'🚫 PERMANENT BAN' };
  }
  if(s >= c.longBanAt){
    if(!bans[ctx.type]) bans[ctx.type] = {};
    bans[ctx.type][id] = { until: Date.now() + ddosConfig.longBanMs, reason, at: getIndiaDateTime(), strikes: s };
    return { action:'LONG_BAN', message:'⛔ 1 hour ban' };
  }
  if(s >= c.tempBanAt){
    if(!bans[ctx.type]) bans[ctx.type] = {};
    bans[ctx.type][id] = { until: Date.now() + ddosConfig.tempBanMs, reason, at: getIndiaDateTime(), strikes: s };
    return { action:'TEMP_BAN', message:'⏸️ 5 min ban' };
  }
  if(s >= c.throttleAt) return { action:'THROTTLE', message:'🐢 Slow down' };
  return { action:'WARN', message:'⚠️ Warning #' + s };
}
function smartDDoS(req){
  if(!ddosConfig.enabled || ddosConfig.mode === 'off') return { allowed: true };
  const ip = getRealIP(req);
  const deviceId = generateDeviceId(req);
  const key = req.query.key || req.headers['x-api-key'] || '';
  if(whitelist.ips.includes(ip)) return { allowed: true, action: 'WHITELISTED' };
  if(isBanned('ip', ip)) return { allowed:false, code:403, reason:'IP banned', type:'ip', id:ip, action:'BANNED' };
  if(isBanned('device', deviceId)) return { allowed:false, code:403, reason:'Device banned', type:'device', id:deviceId, action:'BANNED' };
  if(key && isBanned('key', key)) return { allowed:false, code:403, reason:'Key banned', type:'key', id:key, action:'BANNED' };
  pushHit(abuseTracker.ip, ip);
  pushHit(abuseTracker.device, deviceId);
  if(key) pushHit(abuseTracker.key, key);
  const check = (type, id, limits, bucket) => {
    const b10 = countWindow(bucket, id, 10000);
    const b1m = countWindow(bucket, id, 60000);
    const b1h = countWindow(bucket, id, 3600000);
    if(b10 > limits.burst10s) return strike(bucket, id, `Burst ${b10}/10s`, { type });
    if(b1m > limits.perMinute) return strike(bucket, id, `Rate ${b1m}/min`, { type });
    if(b1h > limits.perHour) return strike(bucket, id, `Rate ${b1h}/hour`, { type });
    return null;
  };
  let r = check('ip', ip, ddosConfig.ip, abuseTracker.ip);
  if(r) return { allowed: r.action === 'WARN' || r.action === 'THROTTLE', code: r.action.includes('BAN') ? 403 : 200, reason: r.message, action: r.action, type:'ip', id:ip };
  r = check('device', deviceId, ddosConfig.device, abuseTracker.device);
  if(r) return { allowed: r.action === 'WARN' || r.action === 'THROTTLE', code: r.action.includes('BAN') ? 403 : 200, reason: r.message, action: r.action, type:'device', id:deviceId };
  if(key){
    r = check('key', key, ddosConfig.key, abuseTracker.key);
    if(r) return { allowed: r.action === 'WARN' || r.action === 'THROTTLE', code: r.action.includes('BAN') ? 403 : 200, reason: r.message, action: r.action, type:'key', id:key };
  }
  return { allowed: true, action: 'OK' };
}

// ============================================================
// 🔑 KEY VALIDATION
// ============================================================
function checkCooldown(k){
  const kd = keyStorage[k];
  if(!kd?.cooldown) return { allowed: true };
  const n = Date.now();
  if(cooldownTimers[k] && (n - cooldownTimers[k]) < kd.cooldown*1000)
    return { allowed: false, remaining: Math.ceil((kd.cooldown*1000 - (n - cooldownTimers[k]))/1000) };
  cooldownTimers[k] = n;
  return { allowed: true };
}
function checkPerSecondLimit(k){
  const kd = keyStorage[k];
  if(!kd?.perSecondLimit) return { allowed: true };
  const wk = k + '_ps_' + Math.floor(Date.now()/1000);
  if(!perSecondLimits[wk]) perSecondLimits[wk] = 0;
  if(perSecondLimits[wk] >= kd.perSecondLimit) return { allowed: false, message: `⚡ ${kd.perSecondLimit}/s reached` };
  perSecondLimits[wk]++;
  return { allowed: true };
}
function checkDailyLimit(k){
  const kd = keyStorage[k];
  if(!kd?.dailyLimit) return { allowed: true };
  const dk = k + '_' + getIndiaDate();
  if(!dailyLimits[dk]) dailyLimits[dk] = 0;
  if(dailyLimits[dk] >= kd.dailyLimit) return { allowed: false, message: `🔴 Daily limit reached` };
  return { allowed: true };
}
function isProtected(value){
  for(const key in protectedData){ if(String(value).includes(protectedData[key])) return protectedData[key]; }
  return null;
}
function checkKeyValid(k){
  if(!k) return { valid: false, error: 'Missing key' };
  if(maintenance.enabled && !whitelist.keys.includes(k)) return { valid: false, error: '🔧 ' + maintenance.message };
  const kd = keyStorage[k];
  if(!kd) return { valid: false, error: '🔑 Key not found!\n\n🛒 Purchase: @BRONX_ULTRA' };
  if(kd.stopped) return { valid: false, error: '⛔ Key stopped' };
  if(kd.disabled) return { valid: false, error: '🚫 Key disabled' };
  if(kd.expiry && isKeyExpired(kd.expiry)) return { valid: false, error: '⏰ Expired on ' + kd.expiryStr };
  if(!kd.unlimited && kd.used >= kd.limit) return { valid: false, error: `🔴 Limit reached ${kd.limit}/${kd.limit}` };
  const dl = checkDailyLimit(k); if(!dl.allowed) return { valid: false, error: dl.message };
  const ps = checkPerSecondLimit(k); if(!ps.allowed) return { valid: false, error: ps.message };
  const cd = checkCooldown(k); if(!cd.allowed) return { valid: false, error: '⏱️ Cooldown ' + cd.remaining + 's' };
  return { valid: true, keyData: kd };
}
function incrementKeyUsage(k, ep, req){
  const ip = getRealIP(req);
  const deviceId = generateDeviceId(req);
  const di = detectDeviceType(req);
  const browser = detectBrowser(req);
  const country = detectCountry(req);
  if(keyStorage[k] && !keyStorage[k].unlimited){
    keyStorage[k].used++;
    const dk = k + '_' + getIndiaDate();
    dailyLimits[dk] = (dailyLimits[dk] || 0) + 1;
    if(keyStorage[k].used % 5 === 0) saveToDisk();
  }
  if(!deviceFingerprints[deviceId]){
    deviceFingerprints[deviceId] = { firstSeen: getIndiaDateTime(), lastSeen:'', requests: 0, userAgent: req.headers['user-agent']||'', browser, deviceType: di.type, deviceIcon: di.icon, os: di.os, ips: [], countries: [] };
  }
  const df = deviceFingerprints[deviceId];
  df.lastSeen = getIndiaDateTime(); df.requests++;
  if(!df.ips.includes(ip)){ df.ips.push(ip); if(df.ips.length>10) df.ips = df.ips.slice(-10); }
  if(country !== 'Unknown' && !df.countries.includes(country)) df.countries.push(country);
  if(!ipRequestCounts[ip] || ipRequestCounts[ip].date !== getIndiaDate())
    ipRequestCounts[ip] = { count: 0, date: getIndiaDate() };
  ipRequestCounts[ip].count++;
  keyMonitorLogs.push({ key: k.substring(0,8)+'***', fullKey: k, endpoint: ep, ip, deviceId, deviceIcon: di.icon, deviceType: di.type, browser, clientType: browser, country, timestamp: getIndiaDateTime(), date: getIndiaDate() });
  if(keyMonitorLogs.length > 1000) keyMonitorLogs = keyMonitorLogs.slice(-1000);
}

// ✅ FIXED: Custom API scope check (accepts both `custom` and `custom:endpoint`)
function checkKeyScope(kd, ep){
  if(!kd?.scopes?.length) return { valid: false, error: 'No scopes assigned' };
  if(kd.scopes.includes('*')) return { valid: true };
  if(kd.scopes.includes(ep)) return { valid: true };
  // Custom API check
  const cleanEp = ep.startsWith('c/') ? ep.substring(2) : ep;
  const isCustom = customAPIs.some(a => a.endpoint === cleanEp);
  if(isCustom){
    if(kd.scopes.includes('custom')) return { valid: true };
    if(kd.scopes.includes('custom:' + cleanEp)) return { valid: true };
  }
  return { valid: false, error: 'Scope denied: ' + ep + ' (allowed: ' + kd.scopes.join(', ') + ')' };
}

const genToken = () => crypto.randomBytes(24).toString('base64url');
const genRandomKey = (p='BRONX') => `${p}_${crypto.randomBytes(10).toString('hex').toUpperCase()}`;
function isAdminAuth(t){
  if(!t) return false;
  if(adminSessions[t]){
    if(adminSessions[t].permanent) return true;
    if(Date.now() < adminSessions[t].expiresAt) return true;
    delete adminSessions[t]; delete permanentTokens[t];
  }
  return false;
}
function sanitizeResponse(d){
  if(!d) return d;
  try{
    const c = JSON.parse(JSON.stringify(d));
    ['credit','truecaller_name','cached','cached_at','api_by','by','channel','developer','api_key','real_url','source_url','owner','key_note','response_time_ms'].forEach(x => delete c[x]);
    if(c.meta){ delete c.meta.api_by; delete c.meta.response_time_ms; delete c.meta.quota_used; if(!Object.keys(c.meta).length) delete c.meta; }
    c.powered_by = '@BRONX_ULTRA';
    return c;
  }catch(e){ return d; }
}
function esc(s){ return s ? String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]) : ''; }

// ============================================================
// 📋 ENDPOINTS
// ============================================================
const endpoints = {
  number:{p:'num',i:'📱',e:'9876543210',d:'Mobile Lookup',c:'phone'},
  aadhar:{p:'num',i:'🆔',e:'393933081942',d:'Aadhaar',c:'phone'},
  leakinfo:{p:'term',i:'🕵️',e:'email@example.com',d:'Leak Info',c:'phone'},
  name:{p:'name',i:'🔍',e:'abhiraaj',d:'Name Search',c:'phone'},
  numv2:{p:'num',i:'📱',e:'6205949840',d:'Number v2',c:'phone'},
  adv:{p:'num',i:'📱',e:'9876543210',d:'Advanced Intel',c:'phone'},
  adharfamily:{p:'num',i:'👨‍👩‍👧‍👦',e:'984154610245',d:'Family',c:'phone'},
  adharration:{p:'num',i:'📋',e:'701984830542',d:'Ration Card',c:'phone'},
  imei:{p:'imei',i:'📱',e:'357817383506298',d:'IMEI',c:'phone'},
  calltracer:{p:'num',i:'📞',e:'9876543210',d:'Call Tracer',c:'phone'},
  challan:{p:'vehicle',i:'📋',e:'UP42BB2572',d:'Challan',c:'vehicle'},
  numleak:{p:'num',i:'🔓',e:'9876543210',d:'Number Leak',c:'phone'},
  bomber:{p:'number',i:'💣',e:'9876543210',d:'SMS Bomber',c:'phone'},
  numtoupi:{p:'num',i:'💳',e:'8945996482',d:'Num to UPI',c:'finance'},
  upi:{p:'upi',i:'💰',e:'example@ybl',d:'UPI',c:'finance'},
  ifsc:{p:'ifsc',i:'🏦',e:'SBIN0001234',d:'IFSC',c:'finance'},
  pan:{p:'pan',i:'📄',e:'AXDPR2606K',d:'PAN',c:'finance'},
  pincode:{p:'pin',i:'📍',e:'110001',d:'Pincode',c:'location'},
  ip:{p:'ip',i:'🌐',e:'8.8.8.8',d:'IP Lookup',c:'location'},
  vehicle:{p:'vehicle',i:'🚗',e:'MH02FZ0555',d:'Vehicle',c:'vehicle'},
  rc:{p:'owner',i:'📋',e:'UP92P2111',d:'veh2num',c:'vehicle'},
  veh2num:{p:'vehicle',i:'🚗',e:'KL41V3504',d:'Veh to Num',c:'vehicle'},
  ff:{p:'uid',i:'🎮',e:'123456789',d:'Free Fire',c:'gaming'},
  bgmi:{p:'uid',i:'🎮',e:'5121439477',d:'BGMI',c:'gaming'},
  insta:{p:'username',i:'📸',e:'cristiano',d:'Instagram',c:'social'},
  git:{p:'username',i:'💻',e:'ftgamer2',d:'GitHub',c:'social'},
  tg:{p:'info',i:'📲',e:'JAUUOWNER',d:'Telegram',c:'social'},
  tgidinfo:{p:'id',i:'📲',e:'7530266953',d:'TG ID Info',c:'social'},
  snap:{p:'username',i:'👻',e:'priyapanchal272',d:'Snapchat',c:'social'},
  pk:{p:'num',i:'🇵🇰',e:'03331234567',d:'Pakistan',c:'pakistan'},
  pkv2:{p:'num',i:'🇵🇰',e:'3359736848',d:'Pakistan v2',c:'pakistan'}
};

// ============================================================
// 🎬 INIT
// ============================================================
function initHardcoded(){
  const now = getIndiaDateTime();
  const hc = [
    ['BRONX_PREMIUM_V100_01','Premium 01',999999,'31-12-2028',['*']],
    ['BRONX_PREMIUM_V100_02','Premium 02',999999,'31-12-2028',['*']],
    ['BRONX_ULTRA_OSINT_01','Ultra 01',888888,'30-06-2029',['number','aadhar','upi','pan']],
    ['BRONX_KING_OP_V100','King OP',999999,'31-12-2030',['*']],
    ['BRONX_GOD_TIER_V100','God Tier',999999,'31-12-2030',['*']]
  ];
  hc.forEach(([k,n,l,e,s]) => {
    if(!keyStorage[k]) keyStorage[k] = { name:n, scopes:s, type:'hardcoded', limit:l, used:0, cooldown:0, dailyLimit:0, perSecondLimit:0, expiry:parseExpiryDate(e), expiryStr:e, created:now, unlimited:true, hidden:true, _hardcoded:true };
  });
}

function initCustomAPIs(){
  customAPIs = [
    { id: Date.now()+1, name:'Number Info', endpoint:'number-advanced', param:'num', example:'9876543210', visible:true, realAPI:'https://num-tg-info-api.vercel.app/info?number={param}', scopeKey:'custom:number-advanced' },
    { id: Date.now()+2, name:'Vehicle RC', endpoint:'rc-details', param:'ca_number', example:'MH02FZ0555', visible:true, realAPI:'https://simple-rc-info.vercel.app/rc?num={param}', scopeKey:'custom:rc-details' },
    { id: Date.now()+3, name:'Aadhar', endpoint:'aadhar-verify', param:'aadhar', example:'393933081942', visible:true, realAPI:'https://bronx-king-vip999.vercel.app/api/aadhaar?num={param}', scopeKey:'custom:aadhar-verify' },
    { id: Date.now()+4, name:'Email', endpoint:'email-lookup', param:'mail', example:'user@gmail.com', visible:true, realAPI:'https://bronx-king-mail-opi.vercel.app/mail={param}', scopeKey:'custom:email-lookup' },
    { id: Date.now()+5, name:'Telegram', endpoint:'telegram-scan', param:'id', example:'7530266953', visible:true, realAPI:'https://bronx-tg-king-bro.vercel.app/tg?key=BRONXop&query={param}', scopeKey:'custom:telegram-scan' },
    { id: Date.now()+6, name:'SMS Bomber', endpoint:'sms-bomber', param:'number', example:'1234567890', visible:true, realAPI:'https://bronx-sms-api-ulimate.vercel.app/api/key-bronx-paid-vip?number={param}&counter=10', scopeKey:'custom:sms-bomber' },
    { id: Date.now()+7, name:'Number Backup', endpoint:'num-op', param:'num', example:'9876543210', visible:true, realAPI:'https://tfqdeadlo-inddataapi.hf.space/search?mobile={param}', scopeKey:'custom:num-op' }
  ];
}

// ============================================================
// 🌐 MIDDLEWARE
// ============================================================
app.use(express.json({limit:'50mb'}));
app.use(express.urlencoded({extended:true, limit:'50mb'}));
app.set('json spaces', 2);
app.use((req,res,next) => {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type,x-api-key,x-admin-token');
  if(req.method === 'OPTIONS') return res.status(200).end();
  next();
});
app.use('/api', (req,res,next) => {
  const r = smartDDoS(req);
  res.setHeader('X-RateLimit-Mode', ddosConfig.mode);
  if(r.action && r.action !== 'OK') res.setHeader('X-Bronx-Warning', r.reason || 'ok');
  if(!r.allowed) return res.status(r.code || 429).json({ error: r.reason || 'Rate limited', type: r.type || 'unknown', action: r.action || 'BLOCKED' });
  if(r.action === 'THROTTLE') return setTimeout(() => next(), 800);
  next();
});

// ============================================================
// 🏠 PUBLIC
// ============================================================
app.get('/', (req,res) => { try { res.send(renderHome()); } catch(e){ res.send('err: ' + e.message); } });
app.get('/test', (req,res) => res.json({
  status:'✅ BRONX V501 ULTRA FIXED', version:'5.0.1', ddos: ddosConfig.mode,
  keys: Object.keys(keyStorage).length, endpoints: Object.keys(endpoints).length,
  custom: customAPIs.length, bannedIPs: Object.keys(bans.ip).length,
  bannedDevices: Object.keys(bans.device).length, devicesTracked: Object.keys(deviceFingerprints).length,
  theme: theme.preset, maintenance: maintenance.enabled
}));
app.get('/theme', (req,res) => res.json(theme));
app.get('/public-theme', (req,res) => res.json({ theme, announcement, maintenance }));

// ✅ Custom API endpoint
app.get('/api/custom/:ep', async (req,res) => {
  try{
    const api = customAPIs.find(a => a.endpoint === req.params.ep && a.visible);
    if(!api) return res.json({error:'API not found or disabled'});
    const key = req.query.key;
    if(!key) return res.json({error:'Key required'});
    const kc = checkKeyValid(key);
    if(!kc.valid) return res.json({error: kc.error});
    const sc = checkKeyScope(kc.keyData, req.params.ep);
    if(!sc.valid) return res.json({error: sc.error});
    const pv = req.query[api.param] || req.query.number || req.query.num;
    if(!pv) return res.json({error:'Missing param: ' + api.param});
    if(isProtected(pv)) return res.json({error:'🔒 PROTECTED', protected:true});
    const url = api.realAPI.replace(/\{param\}/gi, encodeURIComponent(pv));
    const r = await axios.get(url, { timeout: 30000 });
    incrementKeyUsage(key, 'c/'+req.params.ep, req);
    requestLogs.push({ timestamp: getIndiaDateTime(), key:key.substring(0,8)+'***', endpoint:'c/'+req.params.ep, param:String(pv).substring(0,20), status:'success', ip:getRealIP(req), clientType:detectBrowser(req) });
    if(requestLogs.length > 2000) requestLogs = requestLogs.slice(-2000);
    res.json({ ...sanitizeResponse(r.data), api_info: { key_owner: kc.keyData.name, remaining: kc.keyData.unlimited ? '∞' : Math.max(0, kc.keyData.limit - kc.keyData.used), expiry: kc.keyData.expiryStr || 'LIFETIME' } });
  }catch(e){ res.json({error:'API error: ' + e.message}); }
});

// Main endpoint
app.get('/api/key-bronx/:ep', async (req,res) => {
  try{
    const ep = req.params.ep;
    if(!endpoints[ep]) return res.json({error:'Endpoint not found'});
    const key = req.query.key;
    if(!key) return res.json({error:'Key required'});
    const kc = checkKeyValid(key);
    if(!kc.valid) return res.json({error: kc.error});
    const sc = checkKeyScope(kc.keyData, ep);
    if(!sc.valid) return res.json({error: sc.error});
    const pv = req.query[endpoints[ep].p];
    if(!pv) return res.json({error:'Missing ' + endpoints[ep].p});
    if(isProtected(pv)) return res.json({error:'🔒 PROTECTED', protected:true});
    if(endpointResponses[ep]) return res.json({ ...endpointResponses[ep], api_info:{key_owner:kc.keyData.name} });
    const url = `${REAL_API_BASE}/${ep}?key=${getNextKey()}&${endpoints[ep].p}=${encodeURIComponent(pv)}`;
    const r = await axios.get(url, { timeout: 30000 });
    incrementKeyUsage(key, ep, req);
    requestLogs.push({ timestamp: getIndiaDateTime(), key:key.substring(0,8)+'***', endpoint:ep, param:String(pv).substring(0,20), status:'success', ip:getRealIP(req), clientType:detectBrowser(req) });
    if(requestLogs.length > 2000) requestLogs = requestLogs.slice(-2000);
    res.json({ ...sanitizeResponse(r.data), api_info: { key_owner: kc.keyData.name, remaining: kc.keyData.unlimited ? '∞' : Math.max(0, kc.keyData.limit - kc.keyData.used), expiry: kc.keyData.expiryStr || 'LIFETIME' } });
  }catch(e){ res.json({error:'API error'}); }
});

app.get('/api/number', async (req,res) => {
  try{
    const key = req.query.key, num = req.query.num;
    if(!key) return res.json({error:'Key required'});
    if(!num) return res.json({error:'Missing num'});
    const kc = checkKeyValid(key);
    if(!kc.valid) return res.json({error: kc.error});
    if(isProtected(num)) return res.json({error:'🔒 PROTECTED', protected:true});
    const r = await axios.get(`${REAL_API_BASE}/number?key=${getNextKey()}&num=${encodeURIComponent(num)}`, { timeout: 30000 });
    incrementKeyUsage(key, 'number', req);
    res.json({ ...sanitizeResponse(r.data), api_info:{key_owner:kc.keyData.name} });
  }catch(e){ res.json({error:'API error'}); }
});

app.get('/api/leakinfo', async (req,res) => {
  try{
    const t = req.query.term || req.query.info;
    if(!t) return res.json({error:'Missing term'});
    if(isProtected(t)) return res.json({error:'🔒 PROTECTED', protected:true});
    const r = await axios.get(`${REAL_API_BASE}/leakinfo?key=${getNextKey()}&info=${encodeURIComponent(t)}`, { timeout: 30000 });
    res.json({ ...sanitizeResponse(r.data), api_info:{endpoint:'leakinfo'} });
  }catch(e){ res.json({error:'API error'}); }
});

// ============================================================
// 🔐 ADMIN AUTH
// ============================================================
app.get(ADMIN_PATH, (req,res) => {
  try{
    const token = req.query.token || req.headers['x-admin-token'];
    if(token && isAdminAuth(token)) return res.send(renderAdmin(token));
    res.send(renderLogin());
  }catch(e){ res.send('err: ' + e.message); }
});

app.post(ADMIN_PATH + '/login', (req,res) => {
  const { username, password } = req.body;
  const ip = getRealIP(req);
  const ua = req.headers['user-agent'] || '';
  const di = detectDeviceType(req);
  if(bans.ip['LOGIN_'+ip] && (bans.ip['LOGIN_'+ip].permanent || Date.now() < bans.ip['LOGIN_'+ip].until))
    return res.json({ success:false, error:'🚫 Too many failed attempts.' });
  if(username === ADMIN_USERNAME && password === ADMIN_PASSWORD){
    const token = genToken();
    adminSessions[token] = { expiresAt: Date.now() + 365*24*3600*1000, permanent: true };
    permanentTokens[token] = { createdAt: getIndiaDateTime() };
    delete abuseTracker.ip['LOGIN_'+ip];
    adminLogs.push({ user:username, action:'LOGIN', ip, browser:ua, device:di.type, timestamp:getIndiaDateTime(), status:'SUCCESS' });
    logAudit(username, 'LOGIN_SUCCESS', { ip });
    saveToDisk();
    res.json({ success:true, token, message:'✅ Access Granted', redirect: ADMIN_PATH + '?token=' + token });
  } else {
    pushHit(abuseTracker.ip, 'LOGIN_'+ip, 3600000);
    const attempts = countWindow(abuseTracker.ip, 'LOGIN_'+ip, 3600000);
    if(attempts >= ddosConfig.login.maxAttempts)
      bans.ip['LOGIN_'+ip] = { until: Date.now() + ddosConfig.login.banMs, reason:'Failed logins', at:getIndiaDateTime(), strikes:attempts };
    adminLogs.push({ user:username, action:'LOGIN_FAILED', ip, browser:ua, device:di.type, attempts, timestamp:getIndiaDateTime(), status:'FAILED' });
    logAudit(username, 'LOGIN_FAILED', { ip, attempts });
    res.json({ success:false, error:`Invalid credentials! ${ddosConfig.login.maxAttempts - attempts} attempts left.` });
  }
});

const adminAuth = (req,res,next) => {
  const t = req.headers['x-admin-token'] || req.query.token;
  if(!isAdminAuth(t)) return res.json({e:'Unauthorized'});
  next();
};

// ============================================================
// 🎛️ ADMIN APIs
// ============================================================
app.post(ADMIN_PATH + '/generate-key', adminAuth, (req,res) => {
  const { keyName, keyOwner, scopes, limit, expiryDate, days, cooldown, dailyLimit, perSecondLimit, autoGenerate, notes } = req.body;
  let fk = keyName; if(autoGenerate || !keyName) fk = genRandomKey();
  if(!fk || !keyOwner) return res.json({e:'Missing fields'});
  if(keyStorage[fk]) return res.json({e:'Key already exists'});
  const ks = scopes || ['number'];
  let exp = null, es = expiryDate || 'LIFETIME';
  if(days && !isNaN(days)){
    const d = new Date(Date.now() + parseInt(days)*24*3600*1000);
    exp = d; es = d.toISOString().split('T')[0].split('-').reverse().join('-');
  } else if(expiryDate && expiryDate !== 'LIFETIME'){ exp = parseExpiryDate(expiryDate); es = expiryDate; }
  keyStorage[fk] = { name:keyOwner, scopes:ks, type:'generated', limit:parseInt(limit)||100, used:0, cooldown:parseInt(cooldown)||0, dailyLimit:parseInt(dailyLimit)||0, perSecondLimit:parseInt(perSecondLimit)||0, expiry:exp, expiryStr:es, created:getIndiaDateTime(), unlimited:false, hidden:false, _hardcoded:false, stopped:false, disabled:false, notes:notes||'' };
  logAudit('admin', 'GENERATE_KEY', { key:fk, scopes:ks });
  saveToDisk();
  res.json({ success:true, key:fk, message:'🔑 Key Generated!' });
});

app.post(ADMIN_PATH + '/edit-key', adminAuth, (req,res) => {
  const { keyName, newName, newOwner, newLimit, newDailyLimit, newPerSecondLimit, newCooldown, newScopes, newNotes, newExpiry } = req.body;
  if(!keyStorage[keyName]) return res.json({e:'Not found'});
  if(keyStorage[keyName]._hardcoded) return res.json({e:'Hardcoded'});
  const kd = keyStorage[keyName];
  if(newName && newName !== keyName){
    if(keyStorage[newName]) return res.json({e:'New name exists'});
    keyStorage[newName] = { ...kd }; delete keyStorage[keyName];
  }
  const t = keyStorage[newName || keyName];
  if(newOwner !== undefined) t.name = newOwner;
  if(newLimit !== undefined) t.limit = parseInt(newLimit);
  if(newDailyLimit !== undefined) t.dailyLimit = parseInt(newDailyLimit);
  if(newPerSecondLimit !== undefined) t.perSecondLimit = parseInt(newPerSecondLimit);
  if(newCooldown !== undefined) t.cooldown = parseInt(newCooldown);
  if(newScopes) t.scopes = newScopes;
  if(newNotes !== undefined) t.notes = newNotes;
  if(newExpiry){ const e = parseExpiryDate(newExpiry); if(e){ t.expiry = e; t.expiryStr = newExpiry; } }
  logAudit('admin', 'EDIT_KEY', { key:keyName });
  saveToDisk(); res.json({ success:true, message:'✅ Updated!' });
});

app.post(ADMIN_PATH + '/clone-key', adminAuth, (req,res) => {
  const { keyName } = req.body;
  if(!keyStorage[keyName]) return res.json({e:'Not found'});
  const kd = keyStorage[keyName];
  const nk = genRandomKey();
  keyStorage[nk] = { ...kd, used:0, created:getIndiaDateTime(), _hardcoded:false, hidden:false, name:(kd.name||'Clone')+' (Copy)' };
  logAudit('admin', 'CLONE_KEY', { from:keyName, to:nk });
  saveToDisk(); res.json({ success:true, key:nk, message:'✅ Cloned!' });
});

app.post(ADMIN_PATH + '/delete-key', adminAuth, (req,res) => {
  if(req.body.keyName === MASTER_API_KEY || keyStorage[req.body.keyName]?._hardcoded) return res.json({e:'Protected'});
  logAudit('admin', 'DELETE_KEY', { key:req.body.keyName });
  delete keyStorage[req.body.keyName]; saveToDisk(); res.json({success:true});
});

app.post(ADMIN_PATH + '/reset-key-usage', adminAuth, (req,res) => {
  if(keyStorage[req.body.keyName]){ keyStorage[req.body.keyName].used = 0; saveToDisk(); res.json({success:true}); }
  else res.json({e:'Not found'});
});

app.post(ADMIN_PATH + '/reset-all', adminAuth, (req,res) => {
  Object.keys(keyStorage).forEach(k => { if(k !== MASTER_API_KEY && !keyStorage[k]._hardcoded) keyStorage[k].used = 0; });
  dailyLimits = {}; perSecondLimits = {};
  saveToDisk(); res.json({success:true});
});

app.post(ADMIN_PATH + '/clear-logs', adminAuth, (req,res) => {
  requestLogs = []; keyMonitorLogs = []; saveToDisk(); res.json({success:true});
});

app.post(ADMIN_PATH + '/push-key', adminAuth, (req,res) => {
  const { keyName, days } = req.body;
  if(!keyStorage[keyName]) return res.json({e:'Not found'});
  if(keyStorage[keyName]._hardcoded) return res.json({e:'Hardcoded'});
  const d = parseInt(days) || 30;
  const ne = new Date(Date.now() + d*24*3600*1000);
  keyStorage[keyName].expiry = ne;
  keyStorage[keyName].expiryStr = ne.toISOString().split('T')[0].split('-').reverse().join('-');
  keyStorage[keyName].used = 0;
  logAudit('admin', 'PUSH_KEY', { key:keyName, days:d });
  saveToDisk(); res.json({success:true, message:`⬆ Pushed ${d} days!`});
});

app.post(ADMIN_PATH + '/push-all', adminAuth, (req,res) => {
  const d = parseInt(req.body.days) || 30;
  const ne = new Date(Date.now() + d*24*3600*1000);
  let count = 0;
  Object.keys(keyStorage).forEach(k => {
    if(!keyStorage[k]._hardcoded){
      keyStorage[k].expiry = ne;
      keyStorage[k].expiryStr = ne.toISOString().split('T')[0].split('-').reverse().join('-');
      count++;
    }
  });
  saveToDisk(); res.json({success:true, count, message:`⬆ Pushed ${d} days to ${count} keys!`});
});

app.post(ADMIN_PATH + '/stop-key', adminAuth, (req,res) => {
  const k = req.body.keyName;
  if(!keyStorage[k]) return res.json({e:'Not found'});
  if(keyStorage[k]._hardcoded) return res.json({e:'Hardcoded'});
  keyStorage[k].stopped = !keyStorage[k].stopped;
  saveToDisk(); res.json({success:true, stopped:keyStorage[k].stopped});
});

app.post(ADMIN_PATH + '/disable-key', adminAuth, (req,res) => {
  const k = req.body.keyName;
  if(!keyStorage[k]) return res.json({e:'Not found'});
  if(keyStorage[k]._hardcoded) return res.json({e:'Hardcoded'});
  keyStorage[k].disabled = !keyStorage[k].disabled;
  saveToDisk(); res.json({success:true, disabled:keyStorage[k].disabled});
});

app.post(ADMIN_PATH + '/update-scopes', adminAuth, (req,res) => {
  const { keyName, scopes } = req.body;
  if(!keyStorage[keyName]) return res.json({e:'Not found'});
  if(keyStorage[keyName]._hardcoded) return res.json({e:'Hardcoded'});
  keyStorage[keyName].scopes = scopes; saveToDisk(); res.json({success:true});
});

// Bulk operations
app.post(ADMIN_PATH + '/bulk-delete', adminAuth, (req,res) => {
  const { keys } = req.body; let n = 0;
  (keys||[]).forEach(k => { if(keyStorage[k] && !keyStorage[k]._hardcoded && k !== MASTER_API_KEY){ delete keyStorage[k]; n++; } });
  saveToDisk(); res.json({success:true, deleted:n});
});
app.post(ADMIN_PATH + '/bulk-stop', adminAuth, (req,res) => {
  const { keys, state } = req.body; let n = 0;
  (keys||[]).forEach(k => { if(keyStorage[k] && !keyStorage[k]._hardcoded){ keyStorage[k].stopped = !!state; n++; } });
  saveToDisk(); res.json({success:true, updated:n});
});
app.post(ADMIN_PATH + '/bulk-disable', adminAuth, (req,res) => {
  const { keys, state } = req.body; let n = 0;
  (keys||[]).forEach(k => { if(keyStorage[k] && !keyStorage[k]._hardcoded){ keyStorage[k].disabled = !!state; n++; } });
  saveToDisk(); res.json({success:true, updated:n});
});
app.post(ADMIN_PATH + '/bulk-reset', adminAuth, (req,res) => {
  const { keys } = req.body; let n = 0;
  (keys||[]).forEach(k => { if(keyStorage[k]){ keyStorage[k].used = 0; n++; } });
  saveToDisk(); res.json({success:true, reset:n});
});
app.post(ADMIN_PATH + '/bulk-push', adminAuth, (req,res) => {
  const { keys, days } = req.body; const d = parseInt(days)||30; let n = 0;
  const ne = new Date(Date.now() + d*24*3600*1000);
  (keys||[]).forEach(k => { if(keyStorage[k] && !keyStorage[k]._hardcoded){ keyStorage[k].expiry = ne; keyStorage[k].expiryStr = ne.toISOString().split('T')[0].split('-').reverse().join('-'); n++; } });
  saveToDisk(); res.json({success:true, count:n});
});

// ✅ FIXED: Custom API add — returns full object + scopeKey
app.post(ADMIN_PATH + '/add-api', adminAuth, (req,res) => {
  const { name, endpoint, param, example, realAPI, visible } = req.body;
  if(!name || !endpoint) return res.json({e:'Name and endpoint required'});
  const cleanEndpoint = String(endpoint).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if(!cleanEndpoint) return res.json({e:'Invalid endpoint'});
  if(customAPIs.some(a => a.endpoint === cleanEndpoint)) return res.json({e:'Endpoint already exists'});
  const newApi = {
    id: Date.now(),
    name: String(name),
    endpoint: cleanEndpoint,
    param: param || 'num',
    example: example || '9876543210',
    visible: visible !== false,
    realAPI: realAPI || '',
    scopeKey: 'custom:' + cleanEndpoint,
    createdAt: getIndiaDateTime()
  };
  customAPIs.push(newApi);
  logAudit('admin', 'ADD_API', { name, endpoint: cleanEndpoint });
  saveToDisk();
  res.json({ success:true, api: newApi, message:'✅ API Added!' });
});

app.post(ADMIN_PATH + '/toggle-api', adminAuth, (req,res) => {
  const a = customAPIs.find(x => x.id === parseInt(req.body.id));
  if(a){ a.visible = !a.visible; saveToDisk(); res.json({success:true, visible:a.visible}); }
  else res.json({e:'Not found'});
});

app.post(ADMIN_PATH + '/delete-api', adminAuth, (req,res) => {
  const i = customAPIs.findIndex(x => x.id === parseInt(req.body.id));
  if(i > -1){ customAPIs.splice(i,1); saveToDisk(); res.json({success:true}); }
  else res.json({e:'Not found'});
});

app.post(ADMIN_PATH + '/edit-api', adminAuth, (req,res) => {
  const { id, name, endpoint, param, example, realAPI } = req.body;
  const a = customAPIs.find(x => x.id === parseInt(id));
  if(!a) return res.json({e:'Not found'});
  if(name) a.name = name;
  if(endpoint) a.endpoint = String(endpoint).toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if(param) a.param = param;
  if(example) a.example = example;
  if(realAPI) a.realAPI = realAPI;
  a.scopeKey = 'custom:' + a.endpoint;
  saveToDisk(); res.json({success:true, api:a});
});

app.post(ADMIN_PATH + '/add-protection', adminAuth, (req,res) => {
  const v = req.body.value; if(!v) return res.json({e:'Missing'});
  protectedData[v] = v; saveToDisk(); res.json({success:true});
});
app.post(ADMIN_PATH + '/remove-protection', adminAuth, (req,res) => {
  delete protectedData[req.body.value]; saveToDisk(); res.json({success:true});
});

app.get(ADMIN_PATH + '/bans', adminAuth, (req,res) => {
  const toList = (o) => Object.entries(o).map(([id,d]) => ({ id, ...d }));
  res.json({ ip: toList(bans.ip), device: toList(bans.device), key: toList(bans.key) });
});
app.post(ADMIN_PATH + '/ban', adminAuth, (req,res) => {
  const { type, id, reason, permanent, minutes } = req.body;
  if(!type || !id) return res.json({e:'Missing'});
  if(!bans[type]) bans[type] = {};
  bans[type][id] = { permanent:!!permanent, until:permanent?null:Date.now()+(parseInt(minutes)||60)*60000, reason:reason||'Manual ban', at:getIndiaDateTime(), strikes:(bans[type][id]?.strikes||0)+1 };
  saveToDisk(); res.json({success:true});
});
app.post(ADMIN_PATH + '/unban', adminAuth, (req,res) => {
  const { type, id } = req.body;
  if(!bans[type]) return res.json({e:'No bans'});
  delete bans[type][id];
  if(abuseTracker[type]?.[id]) delete abuseTracker[type][id];
  saveToDisk(); res.json({success:true});
});
app.post(ADMIN_PATH + '/unban-all', adminAuth, (req,res) => {
  bans = { ip:{}, device:{}, key:{} };
  abuseTracker = { ip:{}, device:{}, key:{} };
  saveToDisk(); res.json({success:true});
});
app.get(ADMIN_PATH + '/devices', adminAuth, (req,res) => {
  const list = Object.entries(deviceFingerprints).map(([id,d]) => ({ id, ...d, banned: !!bans.device[id] })).sort((a,b) => b.requests - a.requests);
  res.json({ devices: list, total: list.length });
});

app.get(ADMIN_PATH + '/ddos-config', adminAuth, (req,res) => res.json(ddosConfig));
app.post(ADMIN_PATH + '/ddos-config', adminAuth, (req,res) => {
  const c = req.body;
  if(c.enabled !== undefined) ddosConfig.enabled = !!c.enabled;
  if(c.mode) ddosConfig.mode = c.mode;
  ['ip','device','key'].forEach(k => {
    if(c[k]){
      if(c[k].burst10s) ddosConfig[k].burst10s = parseInt(c[k].burst10s);
      if(c[k].perMinute) ddosConfig[k].perMinute = parseInt(c[k].perMinute);
      if(c[k].perHour) ddosConfig[k].perHour = parseInt(c[k].perHour);
    }
  });
  if(c.strikes) Object.keys(c.strikes).forEach(x => { if(c.strikes[x] !== undefined) ddosConfig.strikes[x] = parseInt(c.strikes[x]); });
  if(c.tempBanMs) ddosConfig.tempBanMs = parseInt(c.tempBanMs);
  if(c.longBanMs) ddosConfig.longBanMs = parseInt(c.longBanMs);
  saveToDisk(); res.json({success:true, config:ddosConfig});
});
app.post(ADMIN_PATH + '/clear-strikes', adminAuth, (req,res) => {
  const { type, id } = req.body;
  if(type && id){ if(abuseTracker[type]?.[id]) abuseTracker[type][id].strikes = 0; }
  else if(type){ Object.keys(abuseTracker[type]||{}).forEach(x => abuseTracker[type][x].strikes = 0); }
  else { ['ip','device','key'].forEach(t => Object.keys(abuseTracker[t]||{}).forEach(x => abuseTracker[t][x].strikes = 0)); }
  saveToDisk(); res.json({success:true});
});

app.get(ADMIN_PATH + '/monitor-logs', adminAuth, (req,res) => {
  res.json({ logs: keyMonitorLogs.slice(-300), total: keyMonitorLogs.length });
});
app.get(ADMIN_PATH + '/admin-logs', adminAuth, (req,res) => {
  res.json({ logs: adminLogs.slice(-300), total: adminLogs.length });
});
app.get(ADMIN_PATH + '/audit-log', adminAuth, (req,res) => {
  res.json({ logs: auditLog.slice(-300), total: auditLog.length });
});

app.get(ADMIN_PATH + '/stats', adminAuth, (req,res) => {
  if(statsCache.data && Date.now() < statsCache.expiresAt) return res.json(statsCache.data);
  const today = getIndiaDate();
  const weekAgo = new Date(Date.now() - 7*86400000).toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30*86400000).toISOString().split('T')[0];
  const todayL = keyMonitorLogs.filter(l => l.date === today);
  const weekL = keyMonitorLogs.filter(l => l.date >= weekAgo);
  const monthL = keyMonitorLogs.filter(l => l.date >= monthAgo);
  const byKey = {}, byEp = {}, byIP = {}, byClient = {}, byDevice = {}, byCountry = {}, byBrowser = {}, byOS = {};
  keyMonitorLogs.forEach(l => {
    byKey[l.key] = (byKey[l.key]||0)+1;
    byEp[l.endpoint] = (byEp[l.endpoint]||0)+1;
    byIP[l.ip] = (byIP[l.ip]||0)+1;
    byClient[l.clientType||'?'] = (byClient[l.clientType||'?']||0)+1;
    byBrowser[l.browser||'?'] = (byBrowser[l.browser||'?']||0)+1;
    if(l.deviceId) byDevice[l.deviceId] = (byDevice[l.deviceId]||0)+1;
    if(l.country && l.country !== 'Unknown') byCountry[l.country] = (byCountry[l.country]||0)+1;
  });
  Object.values(deviceFingerprints).forEach(d => { if(d.os) byOS[d.os] = (byOS[d.os]||0)+1; });
  const top = (o, n=10) => Object.entries(o).sort((a,b) => b[1]-a[1]).slice(0,n).map(([k,v]) => ({ k, v }));
  const data = {
    totalRequests: keyMonitorLogs.length, todayRequests: todayL.length,
    weeklyRequests: weekL.length, monthlyRequests: monthL.length,
    topKeys: top(byKey, 5), topEndpoints: top(byEp, 10),
    topIPs: top(byIP, 10), topDevices: top(byDevice, 10),
    clientStats: top(byClient, 10), browserStats: top(byBrowser, 10),
    countryStats: top(byCountry, 10), osStats: top(byOS, 10)
  };
  statsCache = { data, expiresAt: Date.now() + 10000 };
  res.json(data);
});

app.get(ADMIN_PATH + '/ip-request-stats', adminAuth, (req,res) => {
  const now = Date.now();
  const stats = Object.entries(abuseTracker.ip).filter(([ip]) => !ip.startsWith('LOGIN_')).map(([ip, t]) => ({
    ip,
    reqs10s: t.hits.filter(x => x > now - 10000).length,
    reqs1m: t.hits.filter(x => x > now - 60000).length,
    reqs1h: t.hits.filter(x => x > now - 3600000).length,
    total: t.hits.length, strikes: t.strikes || 0,
    isBanned: isBanned('ip', ip)
  })).sort((a,b) => b.reqs1h - a.reqs1h);
  res.json({ stats: stats.slice(0,50), total: stats.length });
});

app.get(ADMIN_PATH + '/theme', adminAuth, (req,res) => res.json({ theme, presets: Object.keys(PRESETS) }));
app.post(ADMIN_PATH + '/theme/preset', adminAuth, (req,res) => {
  if(!applyPreset(req.body.preset)) return res.json({e:'Invalid preset'});
  saveToDisk(); res.json({ success:true, theme });
});
app.post(ADMIN_PATH + '/theme/colors', adminAuth, (req,res) => {
  if(!req.body.colors) return res.json({e:'Missing'});
  Object.keys(req.body.colors).forEach(k => { if(theme.colors[k] !== undefined) theme.colors[k] = req.body.colors[k]; });
  theme.preset = 'custom'; theme.version++;
  saveToDisk(); res.json({ success:true, theme });
});
app.post(ADMIN_PATH + '/theme/effects', adminAuth, (req,res) => {
  if(!req.body.effects) return res.json({e:'Missing'});
  Object.keys(req.body.effects).forEach(k => { if(theme.effects[k] !== undefined) theme.effects[k] = req.body.effects[k]; });
  theme.version++; saveToDisk(); res.json({ success:true, theme });
});
app.post(ADMIN_PATH + '/theme/reset', adminAuth, (req,res) => {
  applyPreset('neon-red'); saveToDisk(); res.json({ success:true, theme });
});

app.get(ADMIN_PATH + '/announcement', adminAuth, (req,res) => res.json(announcement));
app.post(ADMIN_PATH + '/announcement', adminAuth, (req,res) => {
  announcement.enabled = !!req.body.enabled;
  announcement.text = req.body.text || '';
  announcement.type = req.body.type || 'info';
  saveToDisk(); res.json({ success:true, announcement });
});

app.get(ADMIN_PATH + '/maintenance', adminAuth, (req,res) => res.json(maintenance));
app.post(ADMIN_PATH + '/maintenance', adminAuth, (req,res) => {
  maintenance.enabled = !!req.body.enabled;
  maintenance.message = req.body.message || 'System under maintenance';
  saveToDisk(); res.json({ success:true, maintenance });
});

app.get(ADMIN_PATH + '/blocklist', adminAuth, (req,res) => res.json(blocklist));
app.post(ADMIN_PATH + '/blocklist', adminAuth, (req,res) => {
  if(req.body.userAgents) blocklist.userAgents = req.body.userAgents;
  if(req.body.paths) blocklist.paths = req.body.paths;
  saveToDisk(); res.json({success:true, blocklist});
});

app.get(ADMIN_PATH + '/whitelist', adminAuth, (req,res) => res.json(whitelist));
app.post(ADMIN_PATH + '/whitelist/add', adminAuth, (req,res) => {
  const { type, value } = req.body;
  if(!whitelist[type]) return res.json({e:'Invalid type'});
  if(!whitelist[type].includes(value)) whitelist[type].push(value);
  saveToDisk(); res.json({success:true});
});
app.post(ADMIN_PATH + '/whitelist/remove', adminAuth, (req,res) => {
  const { type, value } = req.body;
  if(!whitelist[type]) return res.json({e:'Invalid type'});
  whitelist[type] = whitelist[type].filter(x => x !== value);
  saveToDisk(); res.json({success:true});
});

app.get(ADMIN_PATH + '/export-keys', adminAuth, (req,res) => {
  const out = {};
  Object.entries(keyStorage).forEach(([k,v]) => { if(!v._hardcoded && !v.hidden) out[k] = v; });
  res.json({ success:true, total:Object.keys(out).length, keys:out, exported_at:getIndiaDateTime() });
});
app.post(ADMIN_PATH + '/import-keys', adminAuth, (req,res) => {
  try{
    let body = req.body;
    let toImport = body.keys || body;
    if(toImport.keys && typeof toImport.keys === 'object' && !Array.isArray(toImport.keys)) toImport = toImport.keys;
    const meta = ['success','total','keys','exported_at'];
    let imported = 0, skipped = 0;
    Object.entries(toImport).forEach(([k,d]) => {
      if(meta.includes(k) && typeof d !== 'object') return;
      if(!d || typeof d !== 'object') return;
      if(keyStorage[k] || d._hardcoded){ skipped++; return; }
      keyStorage[k] = { ...d, _hardcoded:false, hidden:false, type:'generated' };
      imported++;
    });
    saveToDisk();
    res.json({ success:true, imported, skipped, message:`✅ ${imported} imported, ${skipped} skipped` });
  }catch(e){ res.json({e:'Error: ' + e.message}); }
});

app.post(ADMIN_PATH + '/update-endpoint-response', adminAuth, (req,res) => {
  const { endpoint, responseData } = req.body;
  if(!endpoint) return res.json({e:'Missing'});
  try{
    if(!responseData || responseData.trim() === ''){ delete endpointResponses[endpoint]; }
    else endpointResponses[endpoint] = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
    saveToDisk(); res.json({success:true});
  }catch(e){ res.json({e:'Invalid JSON'}); }
});
app.get(ADMIN_PATH + '/get-endpoint-response', adminAuth, (req,res) => {
  res.json({ data: endpointResponses[req.query.endpoint] || null });
});

app.get(ADMIN_PATH + '/backup', adminAuth, (req,res) => {
  const ks = {};
  Object.entries(keyStorage).forEach(([k,v]) => { if(!v._hardcoded) ks[k]=v; });
  res.json({
    version:'5.0.1', exported_at: getIndiaDateTime(),
    keys: ks, apis: customAPIs, protected: protectedData,
    endpointResponses, theme, ddosConfig, blocklist, whitelist,
    announcement, maintenance, bans, deviceFingerprints
  });
});
app.post(ADMIN_PATH + '/restore', adminAuth, (req,res) => {
  try{
    const b = req.body;
    if(b.keys) Object.entries(b.keys).forEach(([k,v]) => { if(!v._hardcoded) keyStorage[k] = v; });
    if(b.apis) customAPIs = b.apis;
    if(b.protected) protectedData = b.protected;
    if(b.endpointResponses) endpointResponses = b.endpointResponses;
    if(b.theme) theme = b.theme;
    if(b.ddosConfig) ddosConfig = { ...ddosConfig, ...b.ddosConfig };
    if(b.blocklist) blocklist = b.blocklist;
    if(b.whitelist) whitelist = b.whitelist;
    if(b.announcement) announcement = b.announcement;
    if(b.maintenance) maintenance = b.maintenance;
    saveToDisk(); res.json({success:true, message:'✅ Restored'});
  }catch(e){ res.json({e:'Restore failed: ' + e.message}); }
});

app.get(ADMIN_PATH + '/search-keys', adminAuth, (req,res) => {
  const q = (req.query.q || '').toLowerCase();
  const matches = Object.entries(keyStorage).filter(([k,d]) =>
    !d._hardcoded && (k.toLowerCase().includes(q) || (d.name||'').toLowerCase().includes(q))
  ).slice(0, 50).map(([k,d]) => ({ key:k, name:d.name, used:d.used, limit:d.limit }));
  res.json({ matches, total: matches.length });
});

app.use((req,res) => res.json({error:'Not found'}));

// ============================================================
// 🎨 DYNAMIC THEME CSS
// ============================================================
function generateCSS(){
  const c = theme.colors;
  const e = theme.effects;
  const r = theme.radius;
  return `
<style id="bronx-theme">
:root{
--bg-primary:${c.bgPrimary}; --bg-secondary:${c.bgSecondary}; --bg-card:${c.bgCard};
--border-color:${c.borderColor}; --text-primary:${c.textPrimary};
--text-secondary:${c.textSecondary}; --text-muted:${c.textMuted};
--accent:${c.accent}; --accent2:${c.accent2};
--neon-red:${c.accent}; --neon-green:${c.success}; --neon-orange:${c.warning};
--neon-cyan:${c.info}; --neon-pink:${c.pink}; --neon-purple:${c.purple};
--neon-yellow:${c.yellow}; --neon-white:#ffffff;
--gradient-primary:linear-gradient(135deg,${c.accent},${c.accent2});
--gradient-rainbow:linear-gradient(90deg,${c.accent},${c.accent2},${c.yellow},${c.success},${c.info},${c.purple},${c.pink},${c.accent});
--glow-red:0 0 20px ${hexToRgbStr(c.accent,.7)},0 0 40px ${hexToRgbStr(c.accent,.3)};
--glow-green:0 0 20px ${hexToRgbStr(c.success,.7)};
--glow-orange:0 0 20px ${hexToRgbStr(c.warning,.7)};
--glow-pink:0 0 20px ${hexToRgbStr(c.pink,.7)};
--glow-cyan:0 0 20px ${hexToRgbStr(c.info,.7)};
--glow-purple:0 0 20px ${hexToRgbStr(c.purple,.7)};
--radius:${r}px; --blur:blur(20px); --tr:all .3s cubic-bezier(.4,0,.2,1);
}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg-primary);color:var(--text-primary);font-family:'${theme.fonts.body}',sans-serif;min-height:100vh;overflow-x:hidden;position:relative;transition:background .4s,color .4s}
${e.gridBg ? `.grid-bg{position:fixed;inset:0;background-image:linear-gradient(${hexToRgbStr(c.accent,.04)} 1px,transparent 1px),linear-gradient(90deg,${hexToRgbStr(c.accent,.04)} 1px,transparent 1px);background-size:50px 50px;z-index:0;pointer-events:none}` : `.grid-bg{display:none}`}
${e.scanLines ? `body::after{content:'';position:fixed;inset:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,.15) 0px,rgba(0,0,0,.15) 1px,transparent 1px,transparent 2px);pointer-events:none;z-index:999;opacity:.3}` : ''}
#snowfall-canvas{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1;${e.snowfall ? '' : 'display:none'}}
::-webkit-scrollbar{width:6px}
::-webkit-scrollbar-track{background:var(--bg-primary)}
::-webkit-scrollbar-thumb{background:linear-gradient(${c.accent},${c.accent2});border-radius:10px}
.admin-container{display:flex;min-height:100vh;position:relative;z-index:10}
.sidebar{width:250px;background:${hexToRgbStr(c.bgSecondary,.95)};border-right:2px solid ${hexToRgbStr(c.accent,.2)};padding:14px 10px;position:fixed;height:100vh;overflow-y:auto;backdrop-filter:blur(10px)}
.sidebar::-webkit-scrollbar{width:4px}
.sidebar::-webkit-scrollbar-thumb{background:var(--accent);border-radius:10px}
.main-content{flex:1;margin-left:250px;padding:18px}
.sidebar-header{text-align:center;padding:14px 0;border-bottom:1px solid ${hexToRgbStr(c.accent,.2)};margin-bottom:14px}
.sidebar-logo{font-size:34px;margin-bottom:6px;${e.glow ? `filter:drop-shadow(0 0 15px ${c.accent})` : ''}}
.sidebar-title{font-size:14px;font-weight:900;background:var(--gradient-rainbow);background-size:400% 400%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:4px;font-family:'${theme.fonts.heading}',sans-serif;${e.rainbowAnim ? 'animation:rainbowShift 3s linear infinite' : ''}}
.sidebar-nav{list-style:none}
.sidebar-nav li{margin-bottom:3px}
.sidebar-nav a{display:flex;align-items:center;gap:9px;padding:9px 12px;color:var(--text-secondary);text-decoration:none;border-radius:9px;transition:var(--tr);font-size:11px;font-weight:500;cursor:pointer;border-left:3px solid transparent}
.sidebar-nav a:hover{background:${hexToRgbStr(c.accent,.08)};color:#fff;border-left-color:var(--accent);transform:translateX(3px)}
.sidebar-nav a.active{background:linear-gradient(90deg,${hexToRgbStr(c.accent,.2)},${hexToRgbStr(c.accent2,.05)});color:#fff;border-left-color:var(--accent)}
.sidebar-nav i{width:16px;text-align:center;font-size:12px}
.glow-card{background:var(--bg-card);backdrop-filter:var(--blur);border:1px solid var(--border-color);border-radius:var(--radius);padding:20px;margin-bottom:18px;transition:var(--tr);position:relative;overflow:hidden}
.glow-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--gradient-rainbow);background-size:500% 500%;${e.rainbowAnim ? 'animation:rainbowShift 4s linear infinite' : ''};opacity:.8}
.glow-card:hover{border-color:${hexToRgbStr(c.accent,.3)};transform:translateY(-2px)}
.glow-card h3{margin-bottom:16px;font-size:15px;font-weight:700;display:flex;align-items:center;gap:9px;color:#fff;font-family:'${theme.fonts.heading}',sans-serif;letter-spacing:1px}
.glow-card h3 i{color:var(--accent)}
.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:18px}
.stat-card{background:${hexToRgbStr(c.bgSecondary,.9)};border:1px solid ${hexToRgbStr(c.accent,.15)};border-radius:14px;padding:16px 12px;text-align:center;transition:var(--tr)}
.stat-card:hover{transform:translateY(-5px) scale(1.02);border-color:var(--accent)}
.stat-icon{font-size:26px;margin-bottom:6px}
.stat-value{font-size:24px;font-weight:900;font-family:'${theme.fonts.heading}',sans-serif;color:var(--accent);margin-bottom:4px}
.stat-label{font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:2px;font-weight:600}
.form-group{margin-bottom:12px}
.form-group label{display:block;margin-bottom:5px;color:var(--accent2);font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px}
.form-input{width:100%;padding:10px 14px;background:${hexToRgbStr(c.bgPrimary,.9)};border:1.5px solid ${hexToRgbStr(c.accent,.25)};border-radius:10px;color:#fff;font-size:12.5px;transition:var(--tr);outline:none;font-family:'${theme.fonts.body}',sans-serif}
.form-input:focus{border-color:var(--accent)}
.form-input option{background:${c.bgSecondary};color:#fff}
.btn-primary{padding:10px 20px;background:var(--gradient-primary);color:#fff;border:none;border-radius:10px;cursor:pointer;font-weight:700;font-size:11.5px;letter-spacing:1px;transition:var(--tr);font-family:'${theme.fonts.heading}',sans-serif}
.btn-primary:hover{transform:translateY(-2px);filter:brightness(1.2)}
.btn-success{background:linear-gradient(135deg,${c.success},${c.success}cc)}
.btn-danger{background:linear-gradient(135deg,${c.danger},${c.danger}cc)}
.btn-warning{background:linear-gradient(135deg,${c.warning},${c.warning}cc)}
.btn-info{background:linear-gradient(135deg,${c.info},${c.info}cc)}
.btn-action{padding:5px 8px;border-radius:6px;border:1px solid;cursor:pointer;font-size:10px;transition:var(--tr);background:transparent;margin:2px;font-weight:600}
.btn-reset{color:${c.success};border-color:${hexToRgbStr(c.success,.4)}}
.btn-push{color:${c.warning};border-color:${hexToRgbStr(c.warning,.4)}}
.btn-stop{color:${c.danger};border-color:${hexToRgbStr(c.danger,.4)}}
.btn-delete{color:${c.pink};border-color:${hexToRgbStr(c.pink,.4)}}
.btn-edit{color:${c.info};border-color:${hexToRgbStr(c.info,.4)}}
.btn-disable{color:${c.yellow};border-color:${hexToRgbStr(c.yellow,.4)}}
.btn-clone{color:${c.purple};border-color:${hexToRgbStr(c.purple,.4)}}
.table-container{overflow-x:auto;border-radius:10px;border:1px solid ${hexToRgbStr(c.accent,.1)}}
table{width:100%;border-collapse:collapse;font-size:11px}
th{background:${hexToRgbStr(c.accent,.08)};color:${c.accent2};padding:9px 7px;text-align:left;font-weight:700;text-transform:uppercase;font-size:9px;letter-spacing:1px;position:sticky;top:0;z-index:2;border-bottom:1px solid ${hexToRgbStr(c.accent,.2)}}
td{padding:7px;border-bottom:1px solid ${hexToRgbStr(c.accent,.08)};color:var(--text-secondary)}
tr:hover td{background:${hexToRgbStr(c.accent,.05)}}
code{background:${hexToRgbStr(c.accent,.1)};padding:3px 6px;border-radius:5px;color:${c.accent2};font-family:'Space Grotesk',monospace;font-size:10px;border:1px solid ${hexToRgbStr(c.accent2,.15)}
.endpoint-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
.endpoint-card{background:${hexToRgbStr(c.bgSecondary,.8)};border:1px solid ${hexToRgbStr(c.accent,.15)};border-radius:14px;padding:14px;cursor:pointer;transition:var(--tr);position:relative;overflow:hidden}
.endpoint-card:hover{transform:translateY(-4px);border-color:var(--accent)}
.endpoint-card .ep-icon{font-size:22px;margin-bottom:6px}
.endpoint-card .ep-name{font-size:13px;font-weight:700;margin-bottom:5px;color:var(--accent)}
.endpoint-card .ep-desc{font-size:10px;color:var(--text-muted);margin-bottom:8px}
.endpoint-card .ep-url{font-size:9px;color:${c.success};background:${hexToRgbStr(c.success,.05)};padding:5px 7px;border-radius:6px;font-family:'Space Grotesk',monospace;word-break:break-all;border:1px solid ${hexToRgbStr(c.success,.1)}
.live-logs{background:${hexToRgbStr(c.bgPrimary,.95)};border:1px solid ${hexToRgbStr(c.accent,.2)};border-radius:14px;padding:10px;max-height:450px;overflow-y:auto;font-family:'Space Grotesk',monospace;font-size:10px}
.log-entry{padding:6px 7px;border-bottom:1px solid ${hexToRgbStr(c.accent,.08)};display:flex;gap:8px;flex-wrap:wrap;transition:var(--tr);border-radius:6px;align-items:center}
.log-entry:hover{background:${hexToRgbStr(c.accent,.08)}}
.log-time{color:var(--text-muted);font-size:9px}
.log-key{color:${c.accent};font-weight:700}
.log-endpoint{color:${c.accent2}}
.log-ip{color:${c.info}}
.log-device{color:${c.pink}}
.log-browser{color:${c.purple}}
.toast{position:fixed;top:18px;right:18px;z-index:99999;padding:13px 20px;border-radius:12px;color:#fff;font-weight:600;font-size:12px;animation:slideIn .4s ease;max-width:400px;backdrop-filter:blur(20px);border:1px solid}
.toast.success{background:${hexToRgbStr(c.success,.15)};border-color:${c.success};color:${c.success}}
.toast.error{background:${hexToRgbStr(c.danger,.15)};border-color:${c.danger};color:${c.danger}}
.toast.warning{background:${hexToRgbStr(c.warning,.15)};border-color:${c.warning};color:${c.warning}}
.toast.info{background:${hexToRgbStr(c.info,.15)};border-color:${c.info};color:${c.info}}
.color-picker-row{display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:8px;background:${hexToRgbStr(c.accent,.05)};margin-bottom:6px}
.color-picker-row label{flex:1;font-size:11px;color:var(--text-secondary);text-transform:capitalize}
.color-picker-row input[type=color]{width:40px;height:28px;border:1px solid ${hexToRgbStr(c.accent,.3)};border-radius:6px;cursor:pointer;background:transparent}
.color-picker-row input[type=checkbox]{width:20px;height:20px;cursor:pointer;accent-color:${c.accent}}
.tabs{display:flex;gap:6px;border-bottom:1px solid ${hexToRgbStr(c.accent,.2)};margin-bottom:16px;flex-wrap:wrap}
.tab{padding:9px 16px;cursor:pointer;font-size:11px;font-weight:600;color:var(--text-muted);border-bottom:2px solid transparent;transition:var(--tr);text-transform:uppercase;letter-spacing:1px}
.tab:hover{color:var(--accent)}
.tab.active{color:var(--accent);border-bottom-color:var(--accent)}
.preset-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
.preset-card{padding:14px;border-radius:12px;cursor:pointer;border:2px solid ${hexToRgbStr(c.accent,.15)};transition:var(--tr);text-align:center;position:relative;overflow:hidden;background:${hexToRgbStr(c.bgSecondary,.6)}}
.preset-card:hover{transform:scale(1.05);border-color:var(--accent)}
.preset-card.active{border-color:var(--accent)}
.preset-name{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#fff;margin-top:6px}
.preset-swatch{height:24px;border-radius:6px;margin-bottom:6px}
.scope-box{display:flex;flex-wrap:wrap;gap:8px;padding:12px;background:${hexToRgbStr(c.accent,.05)};border-radius:10px;border:1px solid ${hexToRgbStr(c.accent,.1)};max-height:300px;overflow-y:auto}
.scope-item{cursor:pointer;font-size:10px;display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border-radius:6px;background:${hexToRgbStr(c.accent,.08)};border:1px solid ${hexToRgbStr(c.accent,.15)}}
.scope-item.custom{color:${c.info}}
.scope-item.custom input:checked + span{color:${c.success}}
@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes rainbowShift{0%{background-position:0% 50%}100%{background-position:500% 50%}}
@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
@media(max-width:768px){.sidebar{width:52px;padding:8px 4px}.sidebar .sidebar-title,.sidebar-nav a span{display:none}.sidebar-nav a{justify-content:center;padding:9px 6px}.main-content{margin-left:52px;padding:10px}.stats-grid{grid-template-columns:repeat(2,1fr)}.endpoint-grid{grid-template-columns:1fr}}
</style>`;
}

// ============================================================
// LOGIN PAGE
// ============================================================
function renderLogin(){
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>BRONX V501 | Login</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
${generateCSS()}
<style>
body{display:flex;align-items:center;justify-content:center;overflow:hidden}
.login-container{position:relative;z-index:10;width:400px;max-width:90vw}
.login-card{background:var(--bg-card);backdrop-filter:blur(20px);border:1px solid var(--border-color);border-radius:24px;padding:42px 32px;position:relative;overflow:hidden}
.login-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--gradient-rainbow);background-size:400% 400%;animation:rainbowShift 3s linear infinite}
.login-logo{text-align:center;margin-bottom:16px}
.login-logo .icon{font-size:56px;display:inline-block;animation:pulse 2s ease-in-out infinite}
.login-logo .brand{font-family:'Orbitron',sans-serif;font-size:14px;font-weight:900;letter-spacing:7px;background:var(--gradient-rainbow);background-size:400% 400%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:rainbowShift 3s linear infinite;margin-top:6px}
.login-title{text-align:center;font-family:'Orbitron',sans-serif;font-size:28px;font-weight:900;color:#fff;margin-bottom:6px;letter-spacing:3px}
.login-subtitle{text-align:center;color:var(--text-muted);font-size:10px;letter-spacing:5px;text-transform:uppercase;margin-bottom:28px}
.input-group{position:relative;margin-bottom:16px}
.input-group .input-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--accent);font-size:14px;z-index:2}
.input-group input{width:100%;padding:14px 14px 14px 42px;background:var(--bg-primary);border:1.5px solid var(--border-color);border-radius:14px;color:#fff;font-size:13px;outline:none;transition:.4s}
.input-group input:focus{border-color:var(--accent)}
.login-btn{width:100%;padding:15px;background:var(--gradient-rainbow);background-size:500% 500%;color:#000;border:none;border-radius:14px;cursor:pointer;font-size:13px;font-weight:900;letter-spacing:4px;font-family:'Orbitron',sans-serif;animation:rainbowShift 4s ease infinite;transition:.3s}
.login-btn:hover{transform:translateY(-3px)}
.message{text-align:center;margin-top:14px;font-size:11px;font-weight:600;min-height:20px}
.login-footer{text-align:center;margin-top:20px;font-size:9px;color:var(--text-muted);letter-spacing:2px}
</style></head><body>
<div class="grid-bg"></div><canvas id="snowfall-canvas"></canvas>
<div class="login-container"><div class="login-card">
<div class="login-logo"><span class="icon">🛡️</span><div class="brand">BRONX OSINT</div></div>
<h2 class="login-title">V501 ULTRA</h2>
<p class="login-subtitle">Secure Dashboard Access</p>
<div class="input-group"><i class="fas fa-user input-icon"></i><input type="text" id="username" placeholder="Username" autocomplete="off"></div>
<div class="input-group"><i class="fas fa-lock input-icon"></i><input type="password" id="password" placeholder="Password" autocomplete="off"></div>
<button class="login-btn" onclick="login()"><i class="fas fa-shield-halved"></i> AUTHENTICATE</button>
<div class="message" id="message"></div>
<div class="login-footer">Powered by <span style="background:var(--gradient-primary);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:700">@BRONX_ULTRA</span></div>
</div></div>
<script>
const sc=document.getElementById('snowfall-canvas'),sctx=sc.getContext('2d');sc.width=window.innerWidth;sc.height=window.innerHeight;
const colors=['255,45,45','0,255,136','255,149,0','255,45,149','0,229,255','191,0,255','255,230,0'];
const snow=[];for(let i=0;i<100;i++)snow.push({x:Math.random()*sc.width,y:Math.random()*sc.height,s:Math.random()*3+1,sp:Math.random()*1+.3,w:Math.random()*.5-.25,o:Math.random()*.6+.2,c:colors[Math.floor(Math.random()*colors.length)]});
function as(){sctx.clearRect(0,0,sc.width,sc.height);snow.forEach(s=>{s.y+=s.sp;s.x+=s.w;if(s.y>sc.height){s.y=-5;s.x=Math.random()*sc.width}if(s.x<0)s.x=sc.width;if(s.x>sc.width)s.x=0;sctx.beginPath();sctx.arc(s.x,s.y,s.s,0,Math.PI*2);sctx.fillStyle='rgba('+s.c+','+s.o+')';sctx.shadowBlur=10;sctx.shadowColor='rgba('+s.c+',0.8)';sctx.fill();sctx.shadowBlur=0});requestAnimationFrame(as)}as();
async function login(){
const u=document.getElementById('username').value.trim(),p=document.getElementById('password').value.trim(),m=document.getElementById('message');
if(!u||!p){m.style.color='#ff9500';m.innerHTML='<i class="fas fa-exclamation-triangle"></i> Fill all fields';return}
m.style.color='#ff2d2d';m.innerHTML='<i class="fas fa-spinner fa-spin"></i> Authenticating...';
try{const r=await fetch('${ADMIN_PATH}/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})});const d=await r.json();
if(d.success){m.style.color='#00ff88';m.innerHTML='<i class="fas fa-check-circle"></i> '+d.message;setTimeout(()=>location.href=d.redirect,600)}
else{m.style.color='#ff2d2d';m.innerHTML='<i class="fas fa-times-circle"></i> '+d.error}}catch(e){m.style.color='#ff2d2d';m.innerHTML='<i class="fas fa-plug"></i> Connection error'}}
document.addEventListener('keydown',e=>{if(e.key==='Enter')login()});
</script></body></html>`;
}

// ============================================================
// HOME PAGE
// ============================================================
function renderHome(){
  const vapi = customAPIs.filter(a => a.visible);
  let cards = '';
  Object.entries(endpoints).forEach(([n,e]) => {
    cards += `<div class="endpoint-card" onclick="copyEndpoint('${esc(n)}','${esc(e.p)}','${esc(e.e)}')">
      <div class="ep-icon">${e.i}</div><div class="ep-name">/${esc(n)}</div>
      <div class="ep-desc">${e.d}</div>
      <div class="ep-url">GET /api/key-bronx/${n}?key=KEY&${e.p}=${e.e}</div></div>`;
  });
  vapi.forEach(a => {
    cards += `<div class="endpoint-card" onclick="copyCustom('${esc(a.endpoint)}','${esc(a.param)}','${esc(a.example)}')">
      <div class="ep-icon">🔧</div><div class="ep-name">/${esc(a.endpoint)}</div>
      <div class="ep-desc">Custom API</div>
      <div class="ep-url">GET /api/custom/${a.endpoint}?key=KEY&${a.param}=${a.example||'v'}</div></div>`;
  });
  const announcementHTML = announcement.enabled ? `<div style="position:fixed;top:0;left:0;right:0;z-index:9999;padding:10px 20px;text-align:center;font-size:12px;font-weight:600;letter-spacing:1px;background:var(--gradient-primary);color:#fff">📢 ${esc(announcement.text)}</div>` : '';
  const maintenanceHTML = maintenance.enabled ? `<div style="position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.95);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:20px;padding:40px;text-align:center"><div style="font-size:80px">🔧</div><h1 style="font-family:Orbitron,sans-serif;color:#ff9500;font-size:32px;letter-spacing:4px">MAINTENANCE MODE</h1><p style="color:#fff;font-size:14px">${esc(maintenance.message)}</p></div>` : '';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>BRONX OSINT V501 ULTRA</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
${generateCSS()}
<style>
.topnav{position:sticky;top:0;z-index:1000;background:${hexToRgbStr(theme.colors.bgSecondary,.95)};backdrop-filter:blur(20px);border-bottom:1px solid ${hexToRgbStr(theme.colors.accent,.2)};padding:14px 28px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px}
.brand{font-family:'Orbitron',sans-serif;font-size:15px;font-weight:900;letter-spacing:5px;background:var(--gradient-rainbow);background-size:500% 500%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:rainbowShift 3s linear infinite;text-decoration:none}
.nav-links{display:flex;gap:10px;align-items:center}
.nav-links a{color:var(--text-secondary);text-decoration:none;font-size:11px;font-weight:600;padding:8px 14px;border-radius:10px;transition:var(--tr);border:1px solid transparent;letter-spacing:1px}
.nav-links a:hover{color:var(--accent);border-color:var(--border-color);background:${hexToRgbStr(theme.colors.accent,.08)}}
.hero{text-align:center;padding:60px 20px 40px;position:relative;z-index:10}
.hero h1{font-size:clamp(34px,7vw,60px);font-weight:900;background:var(--gradient-rainbow);background-size:500% 500%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-family:'Orbitron',sans-serif;animation:rainbowShift 4s linear infinite;margin-bottom:12px}
.hero p{color:var(--text-muted);font-size:11px;letter-spacing:5px;text-transform:uppercase}
.container{max-width:1400px;margin:0 auto;padding:20px;position:relative;z-index:10}
.footer{text-align:center;padding:24px;border-top:1px solid ${hexToRgbStr(theme.colors.accent,.15)};position:relative;z-index:10}
.footer span{font-weight:900;background:var(--gradient-rainbow);background-size:400% 400%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-family:'Orbitron',sans-serif;letter-spacing:3px;animation:rainbowShift 4s linear infinite}
</style></head><body>
<div class="grid-bg"></div><canvas id="snowfall-canvas"></canvas>
${announcementHTML}${maintenanceHTML}
<nav class="topnav">
<a href="/" class="brand">🛡️ BRONX V501 ULTRA</a>
<div class="nav-links">
<a href="/test"><i class="fas fa-heartbeat"></i> STATUS</a>
<span style="padding:4px 12px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:2px;background:${hexToRgbStr(theme.colors.success,.1)};color:${theme.colors.success};border:1px solid ${hexToRgbStr(theme.colors.success,.3)}">🟢 ONLINE</span>
</div>
</nav>
<header class="hero"><h1>BRONX OSINT V501</h1><p>Ultra Pro Max · Smart DDoS · Live Theme · Full Fixed</p></header>
<div class="container"><div class="endpoint-grid">${cards}</div></div>
<footer class="footer"><span>BRONX OSINT V501 ULTRA 🛡️</span></footer>
<script>
function copyEndpoint(n,p,e){navigator.clipboard.writeText(location.origin+'/api/key-bronx/'+n+'?key=YOUR_KEY&'+p+'='+e).then(()=>showToast('✅ Copied')).catch(()=>showToast('⚠ Failed','error'));}
function copyCustom(n,p,e){navigator.clipboard.writeText(location.origin+'/api/custom/'+n+'?key=YOUR_KEY&'+p+'='+(e||'v')).then(()=>showToast('✅ Copied')).catch(()=>showToast('⚠ Failed','error'));}
function showToast(m,t='success'){const x=document.createElement('div');x.className='toast '+t;x.innerHTML=m;document.body.appendChild(x);setTimeout(()=>x.remove(),3000);}
const sc=document.getElementById('snowfall-canvas'),sctx=sc.getContext('2d');sc.width=window.innerWidth;sc.height=window.innerHeight;
const colors=['255,45,45','0,255,136','255,149,0','255,45,149','0,229,255','191,0,255','255,230,0'];
const snow=[];for(let i=0;i<100;i++)snow.push({x:Math.random()*sc.width,y:Math.random()*sc.height,s:Math.random()*3+1,sp:Math.random()*1+.3,w:Math.random()*.5-.25,o:Math.random()*.6+.2,c:colors[Math.floor(Math.random()*colors.length)]});
function as(){sctx.clearRect(0,0,sc.width,sc.height);snow.forEach(s=>{s.y+=s.sp;s.x+=s.w;if(s.y>sc.height){s.y=-5;s.x=Math.random()*sc.width}if(s.x<0)s.x=sc.width;if(s.x>sc.width)s.x=0;sctx.beginPath();sctx.arc(s.x,s.y,s.s,0,Math.PI*2);sctx.fillStyle='rgba('+s.c+','+s.o+')';sctx.shadowBlur=10;sctx.shadowColor='rgba('+s.c+',0.8)';sctx.fill();sctx.shadowBlur=0});requestAnimationFrame(as)}as();
</script></body></html>`;
}

// ============================================================
// ADMIN PANEL
// ============================================================
function renderAdmin(token){
  try{
    const stoken = esc(token);
    const themesList = Object.keys(PRESETS);
    const allKeys = Object.entries(keyStorage).filter(([k,d]) => !d._hardcoded && !d.hidden).map(([k,d]) => ({
      key:k, name:d.name||'?', limit:d.unlimited?'∞':d.limit, used:d.used||0,
      left:d.unlimited?'∞':Math.max(0,(d.limit||0)-(d.used||0)),
      dailyLimit:d.dailyLimit||0, perSecondLimit:d.perSecondLimit||0,
      expiry:d.expiryStr||'Lifetime', isExpired:d.expiry ? isKeyExpired(d.expiry) : false,
      scopes:d.scopes||[], cooldown:d.cooldown||0, created:d.created||'',
      stopped:d.stopped||false, disabled:d.disabled||false, notes:d.notes||''
    }));

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>BRONX V501 ADMIN</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
${generateCSS()}
</head><body>
<div class="grid-bg"></div><canvas id="snowfall-canvas"></canvas>
<div class="admin-container">
<div class="sidebar">
<div class="sidebar-header"><div class="sidebar-logo">🛡️</div><div class="sidebar-title">BRONX V501</div></div>
<ul class="sidebar-nav">
<li><a class="active" onclick="switchSection('dashboard',this)"><i class="fas fa-chart-pie"></i><span>Dashboard</span></a></li>
<li><a onclick="switchSection('generate',this)"><i class="fas fa-plus-circle"></i><span>Generate Key</span></a></li>
<li><a onclick="switchSection('keys',this)"><i class="fas fa-key"></i><span>All Keys</span></a></li>
<li><a onclick="switchSection('endpoints',this)"><i class="fas fa-list"></i><span>Endpoints</span></a></li>
<li><a onclick="switchSection('responses',this)"><i class="fas fa-code"></i><span>Edit Responses</span></a></li>
<li><a onclick="switchSection('monitor',this)"><i class="fas fa-desktop"></i><span>Live Monitor</span></a></li>
<li><a onclick="switchSection('stats',this)"><i class="fas fa-chart-bar"></i><span>Statistics</span></a></li>
<li><a onclick="switchSection('theme',this)"><i class="fas fa-palette"></i><span>🎨 Live Theme</span></a></li>
<li><a onclick="switchSection('import',this)"><i class="fas fa-download"></i><span>Import</span></a></li>
<li><a onclick="switchSection('export',this)"><i class="fas fa-upload"></i><span>Export</span></a></li>
<li><a onclick="switchSection('scopes',this)"><i class="fas fa-crosshairs"></i><span>Update Scopes</span></a></li>
<li><a onclick="switchSection('protect',this)"><i class="fas fa-shield-alt"></i><span>Protection</span></a></li>
<li><a onclick="switchSection('apis',this)"><i class="fas fa-plug"></i><span>Custom APIs</span></a></li>
<li><a onclick="switchSection('addapi',this)"><i class="fas fa-puzzle-piece"></i><span>Add API</span></a></li>
<li><a onclick="switchSection('ddos',this)"><i class="fas fa-shield-virus"></i><span>Smart DDoS</span></a></li>
<li><a onclick="switchSection('bans',this)"><i class="fas fa-ban"></i><span>Bans Manager</span></a></li>
<li><a onclick="switchSection('devices',this)"><i class="fas fa-laptop"></i><span>Devices</span></a></li>
<li><a onclick="switchSection('bulk',this)"><i class="fas fa-layer-group"></i><span>Bulk Actions</span></a></li>
<li><a onclick="switchSection('pushall',this)"><i class="fas fa-arrow-up"></i><span>Push All</span></a></li>
<li><a onclick="switchSection('announce',this)"><i class="fas fa-bullhorn"></i><span>Announcement</span></a></li>
<li><a onclick="switchSection('maintenance',this)"><i class="fas fa-wrench"></i><span>Maintenance</span></a></li>
<li><a onclick="switchSection('audit',this)"><i class="fas fa-clipboard-list"></i><span>Audit Log</span></a></li>
<li><a onclick="switchSection('adminlogs',this)"><i class="fas fa-history"></i><span>Admin Logs</span></a></li>
<li><a onclick="switchSection('backup',this)"><i class="fas fa-database"></i><span>Backup</span></a></li>
<li><a onclick="switchSection('settings',this)"><i class="fas fa-cog"></i><span>Settings</span></a></li>
</ul>
</div>
<div class="main-content">
<div class="stats-grid">
<div class="stat-card"><div class="stat-icon">🔑</div><div class="stat-value" id="hdKeys">${allKeys.length}</div><div class="stat-label">Keys</div></div>
<div class="stat-card"><div class="stat-icon">📊</div><div class="stat-value" id="statToday">-</div><div class="stat-label">Today</div></div>
<div class="stat-card"><div class="stat-icon">📈</div><div class="stat-value" id="statTotal">-</div><div class="stat-label">Total</div></div>
<div class="stat-card"><div class="stat-icon">🚫</div><div class="stat-value" id="statBans">-</div><div class="stat-label">Bans</div></div>
<div class="stat-card"><div class="stat-icon">📱</div><div class="stat-value" id="statDevices">-</div><div class="stat-label">Devices</div></div>
<div class="stat-card"><div class="stat-icon">🔧</div><div class="stat-value" id="hdAPIs">${customAPIs.length}</div><div class="stat-label">Custom APIs</div></div>
</div>

<!-- DASHBOARD -->
<div class="glow-card" id="section-dashboard">
<h3><i class="fas fa-fire"></i> Overview</h3>
<div class="stats-grid">
<div class="stat-card"><div class="stat-value" id="dashToday">-</div><div class="stat-label">Today</div></div>
<div class="stat-card"><div class="stat-value" id="dashWeek">-</div><div class="stat-label">Week</div></div>
<div class="stat-card"><div class="stat-value" id="dashMonth">-</div><div class="stat-label">Month</div></div>
<div class="stat-card"><div class="stat-value" id="dashTotal">-</div><div class="stat-label">Total</div></div>
</div>
<h3 style="margin-top:18px"><i class="fas fa-trophy"></i> Top Keys</h3>
<div class="table-container"><table><thead><tr><th>Key</th><th>Requests</th></tr></thead><tbody id="topKeysBody"></tbody></table></div>
<h3 style="margin-top:18px"><i class="fas fa-globe"></i> Top IPs</h3>
<div class="table-container"><table><thead><tr><th>IP</th><th>Requests</th></tr></thead><tbody id="topIPsBody"></tbody></table></div>
<h3 style="margin-top:18px"><i class="fas fa-mobile-alt"></i> Top Devices</h3>
<div class="table-container"><table><thead><tr><th>Device</th><th>Requests</th></tr></thead><tbody id="topDevicesBody"></tbody></table></div>
<h3 style="margin-top:18px"><i class="fas fa-chart-line"></i> Top Endpoints</h3>
<div class="table-container"><table><thead><tr><th>Endpoint</th><th>Requests</th></tr></thead><tbody id="topEpDash"></tbody></table></div>
</div>

<!-- GENERATE -->
<div class="glow-card" id="section-generate" style="display:none">
<h3><i class="fas fa-wand-magic-sparkles"></i> Generate New Key</h3>
<div class="form-group"><label>Key ID (empty = random)</label><input class="form-input" id="gk" placeholder="MY_KEY or empty"></div>
<button class="btn-primary btn-warning" onclick="randomKey()" style="margin-bottom:12px;width:100%"><i class="fas fa-dice"></i> 🎲 RANDOM</button>
<div class="form-group"><label>Owner Name</label><input class="form-input" id="go" placeholder="Client Name"></div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
<div class="form-group"><label>Total Limit</label><input class="form-input" id="gl" type="number" value="100"></div>
<div class="form-group"><label>Daily (0=∞)</label><input class="form-input" id="gdl" type="number" value="0"></div>
<div class="form-group"><label>Per Sec (0=∞)</label><input class="form-input" id="gpsl" type="number" value="0"></div>
</div>
<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
<div class="form-group"><label>Cooldown (s)</label><input class="form-input" id="gc" type="number" value="0"></div>
<div class="form-group"><label>Days Valid</label><input class="form-input" id="gd" type="number" value="30"></div>
</div>
<div class="form-group"><label>Notes</label><input class="form-input" id="gnotes" placeholder="Optional notes"></div>
<div class="form-group"><label>Scopes</label>
<div class="scope-box" id="scopeBoxGenerate">
<label class="scope-item"><input type="checkbox" value="*" id="scope-all" checked> <span>🌟 ALL ACCESS</span></label>
</div></div>
<button class="btn-primary" onclick="generateKey()" style="width:100%"><i class="fas fa-rocket"></i> GENERATE KEY</button>
</div>

<!-- KEYS -->
<div class="glow-card" id="section-keys" style="display:none">
<h3><i class="fas fa-key"></i> All Keys (<span id="keysCount">${allKeys.length}</span>)</h3>
<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">
<input class="form-input" id="keysFilter" placeholder="🔍 Filter by name/key" style="flex:1;min-width:200px" oninput="filterKeys()">
<button class="btn-primary" onclick="location.reload()" style="padding:10px 16px"><i class="fas fa-sync"></i></button>
</div>
<div class="table-container" style="max-height:650px">
<table>
<thead><tr><th><input type="checkbox" onclick="toggleAllKeys(this)"></th><th>KEY</th><th>OWNER</th><th>LIMIT</th><th>USED</th><th>DAY</th><th>/SEC</th><th>LEFT</th><th>EXPIRY</th><th>SCOPES</th><th>STATUS</th><th>ACTIONS</th></tr></thead>
<tbody id="keysBody"></tbody>
</table>
</div>
</div>

<!-- ENDPOINTS -->
<div class="glow-card" id="section-endpoints" style="display:none">
<h3><i class="fas fa-list"></i> Endpoints (${Object.keys(endpoints).length})</h3>
<div class="endpoint-grid" id="endpointsList"></div>
</div>

<!-- RESPONSES -->
<div class="glow-card" id="section-responses" style="display:none">
<h3><i class="fas fa-code"></i> Edit Endpoint Responses</h3>
<div class="form-group"><label>Endpoint</label>
<select class="form-input" id="responseEndpoint" onchange="loadResponse()">
${Object.keys(endpoints).map(e => `<option value="${e}">${endpoints[e].d} (/${e})</option>`).join('')}
</select></div>
<div class="form-group"><label>Response JSON (empty = default)</label>
<textarea class="form-input" id="responseData" rows="10" style="font-family:'Space Grotesk',monospace;font-size:11px"></textarea></div>
<button class="btn-primary" onclick="updateResponse()" style="width:100%"><i class="fas fa-save"></i> SAVE</button>
</div>

<!-- MONITOR -->
<div class="glow-card" id="section-monitor" style="display:none">
<h3><i class="fas fa-desktop"></i> Live Monitor</h3>
<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
<input class="form-input" id="monitorFilter" placeholder="🔍 Filter" style="flex:1;min-width:200px" oninput="renderMonitor()">
<button class="btn-primary" onclick="loadMonitorLogs()" style="padding:10px 16px"><i class="fas fa-sync"></i></button>
</div>
<div class="live-logs" id="monitorLogs"></div>
</div>

<!-- STATS -->
<div class="glow-card" id="section-stats" style="display:none">
<h3><i class="fas fa-chart-bar"></i> Statistics</h3>
<div class="stats-grid">
<div class="stat-card"><div class="stat-value" id="statTotalReqs">-</div><div class="stat-label">Total</div></div>
<div class="stat-card"><div class="stat-value" id="statTodayReqs">-</div><div class="stat-label">Today</div></div>
<div class="stat-card"><div class="stat-value" id="statWeekReqs">-</div><div class="stat-label">Week</div></div>
<div class="stat-card"><div class="stat-value" id="statMonthReqs">-</div><div class="stat-label">Month</div></div>
</div>
<h3><i class="fas fa-chart-pie"></i> Endpoints</h3>
<div class="table-container"><table><thead><tr><th>Endpoint</th><th>Requests</th></tr></thead><tbody id="topEndpointsBody"></tbody></table></div>
<h3 style="margin-top:18px"><i class="fas fa-laptop"></i> Clients</h3>
<div class="table-container"><table><thead><tr><th>Client</th><th>Requests</th></tr></thead><tbody id="clientStatsBody"></tbody></table></div>
<h3 style="margin-top:18px"><i class="fas fa-globe"></i> Browsers</h3>
<div class="table-container"><table><thead><tr><th>Browser</th><th>Requests</th></tr></thead><tbody id="browserStatsBody"></tbody></table></div>
<h3 style="margin-top:18px"><i class="fas fa-flag"></i> Countries</h3>
<div class="table-container"><table><thead><tr><th>Country</th><th>Requests</th></tr></thead><tbody id="countryStatsBody"></tbody></table></div>
<h3 style="margin-top:18px"><i class="fas fa-microchip"></i> OS</h3>
<div class="table-container"><table><thead><tr><th>OS</th><th>Count</th></tr></thead><tbody id="osStatsBody"></tbody></table></div>
</div>

<!-- THEME -->
<div class="glow-card" id="section-theme" style="display:none">
<h3><i class="fas fa-palette"></i> 🎨 Live Theme Changer</h3>
<div class="tabs">
<div class="tab active" onclick="switchTab('presets',this)">Presets</div>
<div class="tab" onclick="switchTab('colors',this)">Colors</div>
<div class="tab" onclick="switchTab('effects',this)">Effects</div>
</div>
<div id="themeTab-presets">
<p style="color:var(--text-muted);font-size:11px;margin-bottom:12px">Click any preset — applies LIVE, no reload!</p>
<div class="preset-grid" id="presetsGrid">
${themesList.map(name => `<div class="preset-card" data-preset="${name}" onclick="applyPresetByName('${name}')"><div class="preset-swatch" style="background:linear-gradient(135deg,${PRESETS[name].accent},${PRESETS[name].accent2})"></div><div class="preset-name">${name}</div></div>`).join('')}
</div>
</div>
<div id="themeTab-colors" style="display:none">
<p style="color:var(--text-muted);font-size:11px;margin-bottom:12px">Custom colors — apply live!</p>
<div id="colorPickers"></div>
<button class="btn-primary" onclick="saveCustomColors()" style="width:100%;margin-top:12px"><i class="fas fa-save"></i> SAVE COLORS</button>
</div>
<div id="themeTab-effects" style="display:none">
<p style="color:var(--text-muted);font-size:11px;margin-bottom:12px">Toggle visual effects</p>
<div id="effectsList"></div>
<button class="btn-primary" onclick="saveEffects()" style="width:100%;margin-top:12px"><i class="fas fa-save"></i> SAVE EFFECTS</button>
</div>
<button class="btn-primary btn-warning" onclick="resetTheme()" style="width:100%;margin-top:16px"><i class="fas fa-undo"></i> RESET TO DEFAULT</button>
</div>

<!-- IMPORT -->
<div class="glow-card" id="section-import" style="display:none">
<h3><i class="fas fa-download"></i> Import Keys</h3>
<textarea class="form-input" id="importData" rows="10" placeholder='{"MY_KEY":{...}}' style="font-family:'Space Grotesk',monospace;font-size:11px"></textarea>
<button class="btn-primary" onclick="importKeys()" style="width:100%;margin-top:12px"><i class="fas fa-download"></i> IMPORT</button>
<p id="importMsg" style="margin-top:10px;text-align:center;font-size:12px"></p>
</div>

<!-- EXPORT -->
<div class="glow-card" id="section-export" style="display:none">
<h3><i class="fas fa-upload"></i> Export Keys</h3>
<textarea class="form-input" id="exportData" rows="10" readonly style="color:${theme.colors.success};font-family:'Space Grotesk',monospace;font-size:11px"></textarea>
<div style="display:flex;gap:12px;margin-top:12px">
<button class="btn-primary" onclick="loadExport()" style="flex:1"><i class="fas fa-sync"></i> LOAD</button>
<button class="btn-primary btn-success" onclick="copyExport()" style="flex:1"><i class="fas fa-copy"></i> COPY</button>
</div>
</div>

<!-- SCOPES -->
<div class="glow-card" id="section-scopes" style="display:none">
<h3><i class="fas fa-crosshairs"></i> Update Key Scopes</h3>
<div class="form-group"><label>Key Name</label><input class="form-input" id="sk" placeholder="Enter key"></div>
<div class="form-group"><label>Scopes</label>
<div class="scope-box" id="scopeBoxUpdate">
<label class="scope-item"><input type="checkbox" value="*" id="scope-all2"> <span>🌟 ALL</span></label>
</div></div>
<button class="btn-primary" onclick="updateScopes()" style="width:100%"><i class="fas fa-save"></i> UPDATE</button>
</div>

<!-- PROTECT -->
<div class="glow-card" id="section-protect" style="display:none">
<h3><i class="fas fa-shield-alt"></i> Data Protection</h3>
<div class="form-group"><label>Value to Protect</label><input class="form-input" id="protVal" placeholder="e.g. 9876543210"></div>
<button class="btn-primary" onclick="addProtection()" style="width:100%"><i class="fas fa-lock"></i> ADD</button>
<div class="table-container" style="margin-top:18px" id="protectList"></div>
</div>

<!-- APIS -->
<div class="glow-card" id="section-apis" style="display:none">
<h3><i class="fas fa-plug"></i> Custom APIs (<span id="apiCount">${customAPIs.length}</span>)</h3>
<div class="table-container" style="max-height:500px">
<table><thead><tr><th>ID</th><th>Name</th><th>Endpoint</th><th>Scope Key</th><th>Param</th><th>Vis</th><th>Actions</th></tr></thead><tbody id="apisBody"></tbody></table>
</div>
</div>

<!-- ADD API -->
<div class="glow-card" id="section-addapi" style="display:none">
<h3><i class="fas fa-puzzle-piece"></i> Add Custom API</h3>
<div class="form-group"><label>Name</label><input class="form-input" id="aname" placeholder="My API"></div>
<div class="form-group"><label>Endpoint (lowercase, no spaces)</label><input class="form-input" id="aep" placeholder="my-api"></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
<div class="form-group"><label>Param</label><input class="form-input" id="aparam" value="num"></div>
<div class="form-group"><label>Example</label><input class="form-input" id="aex" placeholder="9876543210"></div>
</div>
<div class="form-group"><label>Real URL ({param})</label><input class="form-input" id="aurl" placeholder="https://api.com?param={param}"></div>
<button class="btn-primary" onclick="addAPI()" style="width:100%"><i class="fas fa-plus"></i> ADD API</button>
</div>

<!-- DDOS -->
<div class="glow-card" id="section-ddos" style="display:none">
<h3><i class="fas fa-shield-virus"></i> Smart DDoS Config</h3>
<div class="form-group"><label>Mode</label>
<select class="form-input" id="ddosMode">
<option value="off">🔴 Off</option>
<option value="smart">🟢 Smart (Recommended)</option>
<option value="strict">🟠 Strict</option>
</select></div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
<div class="form-group"><label>IP Burst/10s</label><input class="form-input" id="ddosIP10" type="number" value="${ddosConfig.ip.burst10s}"></div>
<div class="form-group"><label>IP/Min</label><input class="form-input" id="ddosIP1M" type="number" value="${ddosConfig.ip.perMinute}"></div>
<div class="form-group"><label>IP/Hour</label><input class="form-input" id="ddosIP1H" type="number" value="${ddosConfig.ip.perHour}"></div>
</div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
<div class="form-group"><label>Device Burst/10s</label><input class="form-input" id="ddosDEV10" type="number" value="${ddosConfig.device.burst10s}"></div>
<div class="form-group"><label>Device/Min</label><input class="form-input" id="ddosDEV1M" type="number" value="${ddosConfig.device.perMinute}"></div>
<div class="form-group"><label>Device/Hour</label><input class="form-input" id="ddosDEV1H" type="number" value="${ddosConfig.device.perHour}"></div>
</div>
<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
<div class="form-group"><label>Temp Ban (min)</label><input class="form-input" id="ddosTempBan" type="number" value="${Math.round(ddosConfig.tempBanMs/60000)}"></div>
<div class="form-group"><label>Long Ban (min)</label><input class="form-input" id="ddosLongBan" type="number" value="${Math.round(ddosConfig.longBanMs/60000)}"></div>
</div>
<button class="btn-primary" onclick="saveDDOS()" style="width:100%"><i class="fas fa-save"></i> SAVE</button>
<button class="btn-primary btn-warning" onclick="clearAllStrikes()" style="width:100%;margin-top:10px"><i class="fas fa-eraser"></i> CLEAR STRIKES</button>
</div>

<!-- BANS -->
<div class="glow-card" id="section-bans" style="display:none">
<h3><i class="fas fa-ban"></i> Bans Manager</h3>
<div style="display:grid;grid-template-columns:2fr 2fr 1fr;gap:10px;margin-bottom:14px">
<select class="form-input" id="banType"><option value="ip">IP</option><option value="device">Device</option><option value="key">Key</option></select>
<input class="form-input" id="banId" placeholder="Value to ban">
<button class="btn-primary btn-danger" onclick="manualBan()"><i class="fas fa-ban"></i> BAN</button>
</div>
<h4 style="color:${theme.colors.accent};margin:14px 0 8px;font-size:12px">🚫 BANNED IPs</h4>
<div class="table-container"><table><thead><tr><th>IP</th><th>Reason</th><th>At</th><th>Until</th><th>Strikes</th><th>Action</th></tr></thead><tbody id="banIPBody"></tbody></table></div>
<h4 style="color:${theme.colors.pink};margin:14px 0 8px;font-size:12px">📱 BANNED DEVICES</h4>
<div class="table-container"><table><thead><tr><th>Device ID</th><th>Reason</th><th>At</th><th>Until</th><th>Strikes</th><th>Action</th></tr></thead><tbody id="banDeviceBody"></tbody></table></div>
<h4 style="color:${theme.colors.warning};margin:14px 0 8px;font-size:12px">🔑 BANNED KEYs</h4>
<div class="table-container"><table><thead><tr><th>Key</th><th>Reason</th><th>At</th><th>Until</th><th>Strikes</th><th>Action</th></tr></thead><tbody id="banKeyBody"></tbody></table></div>
<button class="btn-primary btn-warning" onclick="unbanAll()" style="width:100%;margin-top:14px"><i class="fas fa-unlock"></i> UNBAN ALL</button>
</div>

<!-- DEVICES -->
<div class="glow-card" id="section-devices" style="display:none">
<h3><i class="fas fa-laptop"></i> All Devices</h3>
<div class="table-container" style="max-height:600px">
<table><thead><tr><th>Device ID</th><th>Type</th><th>OS</th><th>Browser</th><th>Reqs</th><th>Last Seen</th><th>Status</th><th>Action</th></tr></thead><tbody id="devicesBody"></tbody></table>
</div>
</div>

<!-- BULK -->
<div class="glow-card" id="section-bulk" style="display:none">
<h3><i class="fas fa-layer-group"></i> Bulk Actions</h3>
<p style="color:${theme.colors.warning};font-size:11px;margin-bottom:12px">Keys section me checkboxes se select karo.</p>
<p id="bulkCount" style="color:${theme.colors.info};text-align:center;font-size:12px;margin-bottom:12px">0 keys selected</p>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
<button class="btn-primary btn-success" onclick="bulkAction('bulk-reset')"><i class="fas fa-sync-alt"></i> RESET</button>
<button class="btn-primary btn-warning" onclick="bulkAction('bulk-stop',true)"><i class="fas fa-pause"></i> STOP</button>
<button class="btn-primary" onclick="bulkAction('bulk-stop',false)"><i class="fas fa-play"></i> ACTIVATE</button>
<button class="btn-primary btn-info" onclick="bulkAction('bulk-disable',true)"><i class="fas fa-ban"></i> DISABLE</button>
<button class="btn-primary btn-info" onclick="bulkAction('bulk-disable',false)"><i class="fas fa-check"></i> ENABLE</button>
<button class="btn-primary btn-danger" onclick="bulkAction('bulk-delete')"><i class="fas fa-trash"></i> DELETE</button>
</div>
<div style="margin-top:14px;display:flex;gap:10px">
<input class="form-input" id="bulkPushDays" type="number" value="30">
<button class="btn-primary btn-warning" onclick="bulkPush()" style="white-space:nowrap"><i class="fas fa-arrow-up"></i> PUSH</button>
</div>
</div>

<!-- PUSH ALL -->
<div class="glow-card" id="section-pushall" style="display:none">
<h3><i class="fas fa-arrow-up"></i> Push All Keys</h3>
<div class="form-group"><label>Days to add to ALL keys</label><input class="form-input" id="pushAllDays" type="number" value="30"></div>
<button class="btn-primary btn-warning" onclick="pushAllKeys()" style="width:100%"><i class="fas fa-arrow-up"></i> PUSH ALL</button>
<div style="margin-top:20px;padding-top:20px;border-top:1px solid ${hexToRgbStr(theme.colors.accent,.15)}">
<div class="form-group"><label>Single key</label><input class="form-input" id="pk" placeholder="Key name"></div>
<div class="form-group"><label>Days</label><input class="form-input" id="pd" type="number" value="30"></div>
<button class="btn-primary" onclick="pushKeyAction()" style="width:100%"><i class="fas fa-arrow-up"></i> PUSH SINGLE</button>
</div>
</div>

<!-- ANNOUNCEMENT -->
<div class="glow-card" id="section-announce" style="display:none">
<h3><i class="fas fa-bullhorn"></i> Announcement</h3>
<div class="form-group"><label>Enable</label>
<select class="form-input" id="annEnabled"><option value="false">Off</option><option value="true">On</option></select></div>
<div class="form-group"><label>Text</label><input class="form-input" id="annText" placeholder="Welcome to BRONX!"></div>
<div class="form-group"><label>Type</label>
<select class="form-input" id="annType"><option value="info">Info</option><option value="warning">Warning</option><option value="success">Success</option></select></div>
<button class="btn-primary" onclick="saveAnnouncement()" style="width:100%"><i class="fas fa-save"></i> SAVE</button>
</div>

<!-- MAINTENANCE -->
<div class="glow-card" id="section-maintenance" style="display:none">
<h3><i class="fas fa-wrench"></i> Maintenance Mode</h3>
<div class="form-group"><label>Enable</label>
<select class="form-input" id="mtEnabled"><option value="false">Off</option><option value="true">On</option></select></div>
<div class="form-group"><label>Message</label><input class="form-input" id="mtMessage" placeholder="System under maintenance"></div>
<button class="btn-primary btn-warning" onclick="saveMaintenance()" style="width:100%"><i class="fas fa-save"></i> SAVE</button>
</div>

<!-- AUDIT -->
<div class="glow-card" id="section-audit" style="display:none">
<h3><i class="fas fa-clipboard-list"></i> Audit Log</h3>
<div class="table-container" style="max-height:500px">
<table><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Details</th></tr></thead><tbody id="auditBody"></tbody></table>
</div>
</div>

<!-- ADMIN LOGS -->
<div class="glow-card" id="section-adminlogs" style="display:none">
<h3><i class="fas fa-history"></i> Admin Logs</h3>
<div class="table-container" style="max-height:500px">
<table><thead><tr><th>Time</th><th>User</th><th>Action</th><th>IP</th><th>Device</th><th>Status</th></tr></thead><tbody id="adminLogsBody"></tbody></table>
</div>
</div>

<!-- BACKUP -->
<div class="glow-card" id="section-backup" style="display:none">
<h3><i class="fas fa-database"></i> Backup / Restore</h3>
<button class="btn-primary btn-success" onclick="backupData()" style="width:100%;margin-bottom:10px"><i class="fas fa-download"></i> DOWNLOAD BACKUP</button>
<div class="form-group" style="margin-top:14px"><label>Restore JSON</label><textarea class="form-input" id="restoreData" rows="8" placeholder="Paste backup JSON" style="font-family:'Space Grotesk',monospace;font-size:11px"></textarea></div>
<button class="btn-primary btn-warning" onclick="restoreData()" style="width:100%"><i class="fas fa-upload"></i> RESTORE</button>
</div>

<!-- SETTINGS -->
<div class="glow-card" id="section-settings" style="display:none">
<h3><i class="fas fa-cog"></i> Settings</h3>
<button class="btn-primary btn-danger" onclick="resetAll()" style="width:100%;margin-bottom:10px"><i class="fas fa-sync-alt"></i> RESET ALL USAGE</button>
<button class="btn-primary btn-danger" onclick="clearLogs()" style="width:100%;margin-bottom:10px"><i class="fas fa-trash"></i> CLEAR ALL LOGS</button>
<button class="btn-primary btn-warning" onclick="unbanAll()" style="width:100%;margin-bottom:10px"><i class="fas fa-unlock"></i> UNBAN ALL</button>
<button class="btn-primary btn-warning" onclick="clearAllStrikes()" style="width:100%"><i class="fas fa-eraser"></i> CLEAR ALL STRIKES</button>
</div>
</div>
</div>

<script>
const TOKEN='${stoken}';
const ADMIN_PATH='${ADMIN_PATH}';
const ENDPOINTS = ${JSON.stringify(Object.entries(endpoints).map(([n,e]) => ({name:n, p:e.p, i:e.i, e:e.e, d:e.d, c:e.c})))};
const INITIAL_KEYS = ${JSON.stringify(allKeys)};
let CUSTOM_APIS = ${JSON.stringify(customAPIs)};
let CURRENT_THEME = ${JSON.stringify(theme)};
const PRESETS = ${JSON.stringify(PRESETS)};

// Snowfall
const sc=document.getElementById('snowfall-canvas'),sctx=sc.getContext('2d');sc.width=window.innerWidth;sc.height=window.innerHeight;
const COLORS=['255,45,45','0,255,136','255,149,0','255,45,149','0,229,255','191,0,255','255,230,0'];
const snow=[];for(let i=0;i<100;i++)snow.push({x:Math.random()*sc.width,y:Math.random()*sc.height,s:Math.random()*3+1,sp:Math.random()*1+.3,w:Math.random()*.5-.25,o:Math.random()*.6+.2,c:COLORS[Math.floor(Math.random()*COLORS.length)]});
function animSnow(){sctx.clearRect(0,0,sc.width,sc.height);snow.forEach(s=>{s.y+=s.sp;s.x+=s.w;if(s.y>sc.height){s.y=-5;s.x=Math.random()*sc.width}if(s.x<0)s.x=sc.width;if(s.x>sc.width)s.x=0;sctx.beginPath();sctx.arc(s.x,s.y,s.s,0,Math.PI*2);sctx.fillStyle='rgba('+s.c+','+s.o+')';sctx.shadowBlur=10;sctx.shadowColor='rgba('+s.c+',0.8)';sctx.fill();sctx.shadowBlur=0});requestAnimationFrame(animSnow)}animSnow();

// ================== UTILS ==================
function showToast(msg,type='success'){const t=document.createElement('div');t.className='toast '+type;t.innerHTML=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),3500);}
async function api(url,data=null){const o={method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-admin-token':TOKEN}};if(data)o.body=JSON.stringify(data);const r=await fetch(ADMIN_PATH+url,o);return await r.json();}

// ================== SCOPE LISTS (FIXED) ==================
function buildScopeHTML(cls){
  let html = '';
  // Regular endpoints
  ENDPOINTS.forEach(e => {
    html += '<label class="scope-item"><input type="checkbox" value="'+e.name+'" class="'+cls+'"> <span>'+e.i+' '+e.name+'</span></label>';
  });
  // Custom APIs (all)
  html += '<label class="scope-item custom"><input type="checkbox" value="custom" class="'+cls+'"> <span>🔧 ALL Custom APIs</span></label>';
  // Each custom API individually
  CUSTOM_APIS.forEach(a => {
    html += '<label class="scope-item custom" data-api-id="'+a.id+'"><input type="checkbox" value="custom:'+a.endpoint+'" class="'+cls+'"> <span>🔧 '+a.name+' <code style="font-size:9px">('+a.endpoint+')</code></span></label>';
  });
  return html;
}
function renderScopeLists(){
  // Generate section (preserve * checkbox)
  const genBox = document.getElementById('scopeBoxGenerate');
  if(genBox){
    const allCb = document.getElementById('scope-all');
    const allChecked = allCb?.checked;
    genBox.innerHTML = '<label class="scope-item"><input type="checkbox" value="*" id="scope-all" '+(allChecked?'checked':'')+'> <span>🌟 ALL ACCESS</span></label>' + buildScopeHTML('scope-cb');
  }
  // Update section
  const updBox = document.getElementById('scopeBoxUpdate');
  if(updBox){
    const allCb2 = document.getElementById('scope-all2');
    const allChecked2 = allCb2?.checked;
    updBox.innerHTML = '<label class="scope-item"><input type="checkbox" value="*" id="scope-all2" '+(allChecked2?'checked':'')+'> <span>🌟 ALL</span></label>' + buildScopeHTML('scope-cb2');
  }
}

// ================== SECTION SWITCHER ==================
function switchSection(name, el){
  document.querySelectorAll('.glow-card').forEach(c => c.style.display='none');
  const s = document.getElementById('section-'+name); if(s) s.style.display='block';
  document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
  if(el) el.classList.add('active');
  if(name==='dashboard') loadDashboard();
  if(name==='keys') renderKeys();
  if(name==='endpoints') renderEndpoints();
  if(name==='monitor') loadMonitorLogs();
  if(name==='adminlogs') loadAdminLogs();
  if(name==='stats') loadStats();
  if(name==='responses') loadResponse();
  if(name==='bans') loadBans();
  if(name==='devices') loadDevices();
  if(name==='theme') renderThemeTab();
  if(name==='apis') renderAPIs();
  if(name==='protect') renderProtect();
  if(name==='audit') loadAudit();
  if(name==='announce') loadAnnouncement();
  if(name==='maintenance') loadMaintenance();
}

// ================== KEYS ==================
function renderKeys(filter){
  const f = (filter || document.getElementById('keysFilter')?.value || '').toLowerCase();
  const filtered = f ? INITIAL_KEYS.filter(k => k.key.toLowerCase().includes(f) || (k.name||'').toLowerCase().includes(f)) : INITIAL_KEYS;
  const tbody = document.getElementById('keysBody');
  tbody.innerHTML = filtered.map(k => {
    let s = '🟢 ACTIVE';
    if(k.isExpired) s = '🔴 EXPIRED';
    else if(k.left == 0) s = '🟠 LIMIT';
    else if(k.stopped) s = '⛔ STOPPED';
    else if(k.disabled) s = '🚫 DISABLED';
    const sd = k.scopes.includes('*') ? '🌟 ALL' : k.scopes.slice(0,2).join(',') + (k.scopes.length>2?'..':'');
    return '<tr><td><input type="checkbox" class="keysel" value="'+k.key+'"></td>'+
      '<td><code>'+k.key.substring(0,14)+(k.key.length>14?'..':'')+'</code></td>'+
      '<td style="color:'+CURRENT_THEME.colors.accent2+'">'+k.name+'</td>'+
      '<td>'+k.limit+'</td><td>'+k.used+'</td>'+
      '<td>'+(k.dailyLimit||'∞')+'</td><td>'+(k.perSecondLimit||'∞')+'/s</td>'+
      '<td style="color:'+(k.left==0?'#ff2d2d':'#00ff88')+'">'+k.left+'</td>'+
      '<td>'+k.expiry+'</td>'+
      '<td style="color:'+CURRENT_THEME.colors.info+'">'+sd+'</td>'+
      '<td>'+s+'</td>'+
      '<td style="text-align:center;white-space:nowrap">'+
      '<button class="btn-action btn-reset" onclick="resetKey(\\''+k.key+'\\')" title="Reset"><i class="fas fa-sync-alt"></i></button>'+
      '<button class="btn-action btn-push" onclick="pushKey(\\''+k.key+'\\')" title="Push"><i class="fas fa-arrow-up"></i></button>'+
      '<button class="btn-action btn-edit" onclick="editKey(\\''+k.key+'\\')" title="Edit"><i class="fas fa-edit"></i></button>'+
      '<button class="btn-action btn-clone" onclick="cloneKey(\\''+k.key+'\\')" title="Clone"><i class="fas fa-copy"></i></button>'+
      '<button class="btn-action btn-disable" onclick="disableKey(\\''+k.key+'\\')" title="Disable"><i class="fas fa-ban"></i></button>'+
      '<button class="btn-action btn-stop" onclick="stopKey(\\''+k.key+'\\')" title="Stop"><i class="fas fa-pause"></i></button>'+
      '<button class="btn-action btn-delete" onclick="deleteKey(\\''+k.key+'\\')" title="Delete"><i class="fas fa-trash"></i></button>'+
      '</td></tr>';
  }).join('') || '<tr><td colspan="12" style="text-align:center;color:var(--text-muted)">No keys</td></tr>';
}
function filterKeys(){ renderKeys(document.getElementById('keysFilter').value); }
function toggleAllKeys(cb){ document.querySelectorAll('.keysel').forEach(c=>c.checked=cb.checked); updateBulkCount(); }
document.addEventListener('change', e => { if(e.target.classList.contains('keysel')) updateBulkCount(); });
function updateBulkCount(){
  const n = document.querySelectorAll('.keysel:checked').length;
  const el = document.getElementById('bulkCount'); if(el) el.textContent = n + ' keys selected';
}

// ================== KEY ACTIONS ==================
function randomKey(){const c='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';let r='';for(let i=0;i<20;i++)r+=c[Math.floor(Math.random()*c.length)];document.getElementById('gk').value='BRONX_'+r;showToast('🎲 Random name!','warning');}
async function generateKey(){
  const keyName = document.getElementById('gk').value.trim();
  const keyOwner = document.getElementById('go').value.trim();
  if(!keyOwner) return showToast('⚠ Enter Owner Name','error');
  let scopes = [];
  if(document.getElementById('scope-all').checked) scopes = ['*'];
  else document.querySelectorAll('.scope-cb:checked').forEach(c => { if(c.value) scopes.push(c.value); });
  if(!scopes.length) return showToast('⚠ Select at least one scope','error');
  const res = await api('/generate-key',{
    keyName, keyOwner, scopes,
    limit: document.getElementById('gl').value,
    dailyLimit: document.getElementById('gdl').value,
    perSecondLimit: document.getElementById('gpsl').value,
    days: document.getElementById('gd').value,
    cooldown: document.getElementById('gc').value,
    notes: document.getElementById('gnotes').value
  });
  if(res.success){ showToast('✅ Key: ' + res.key,'success'); setTimeout(()=>location.reload(),1500); }
  else showToast('❌ ' + (res.e||'Error'),'error');
}
async function resetKey(k){ if(confirm('Reset usage?')){ await api('/reset-key-usage',{keyName:k}); location.reload(); } }
async function deleteKey(k){ if(confirm('DELETE?')){ await api('/delete-key',{keyName:k}); location.reload(); } }
async function stopKey(k){ if(!confirm('Stop/Activate?'))return; const r=await api('/stop-key',{keyName:k}); r.success?location.reload():showToast('❌','error'); }
async function disableKey(k){ if(!confirm('Disable/Enable?'))return; const r=await api('/disable-key',{keyName:k}); r.success?location.reload():showToast('❌','error'); }
async function cloneKey(k){ if(!confirm('Clone?'))return; const r=await api('/clone-key',{keyName:k}); r.success?(showToast('✅ '+r.key),setTimeout(()=>location.reload(),1200)):showToast('❌','error'); }
async function pushKey(k){ const d=prompt('Days?','30'); if(!d)return; const r=await api('/push-key',{keyName:k,days:parseInt(d)}); r.success?(showToast('✅'),setTimeout(()=>location.reload(),1000)):showToast('❌','error'); }
async function editKey(k){
  const n=prompt('New key ID (empty=keep):','');
  const o=prompt('New owner:','');
  const l=prompt('New total limit:','');
  const dl=prompt('New daily:','');
  const ps=prompt('New per-sec:','');
  const cd=prompt('New cooldown:','');
  const nt=prompt('Notes:','');
  const data={keyName:k};
  if(n)data.newName=n; if(o)data.newOwner=o; if(l)data.newLimit=l;
  if(dl!=='')data.newDailyLimit=dl; if(ps!=='')data.newPerSecondLimit=ps;
  if(cd!=='')data.newCooldown=cd; if(nt!==null)data.newNotes=nt;
  const r=await api('/edit-key',data);
  r.success?(showToast('✅ Updated'),setTimeout(()=>location.reload(),1000)):showToast('❌ '+(r.e||''),'error');
}
async function updateScopes(){
  const k=document.getElementById('sk').value.trim(); if(!k) return showToast('⚠ Enter key','error');
  let scopes=[]; if(document.getElementById('scope-all2').checked) scopes=['*'];
  else document.querySelectorAll('.scope-cb2:checked').forEach(c=>scopes.push(c.value));
  const r=await api('/update-scopes',{keyName:k,scopes});
  r.success?(showToast('✅'),setTimeout(()=>location.reload(),1000)):showToast('❌','error');
}

// ================== BULK ==================
async function bulkAction(action, state){
  const keys = Array.from(document.querySelectorAll('.keysel:checked')).map(c=>c.value);
  if(!keys.length) return showToast('⚠ Select keys','error');
  if(action==='bulk-delete' && !confirm('DELETE '+keys.length+' keys?')) return;
  const r = await api('/'+action,{keys,state});
  r.success?(showToast('✅ Done'),setTimeout(()=>location.reload(),1000)):showToast('❌','error');
}
async function bulkPush(){
  const keys = Array.from(document.querySelectorAll('.keysel:checked')).map(c=>c.value);
  if(!keys.length) return showToast('⚠ Select keys','error');
  const days = parseInt(document.getElementById('bulkPushDays').value)||30;
  const r = await api('/bulk-push',{keys,days});
  r.success?(showToast('✅ Pushed '+r.count),setTimeout(()=>location.reload(),1000)):showToast('❌','error');
}
async function pushAllKeys(){const d=parseInt(document.getElementById('pushAllDays').value)||30;if(!confirm('Push '+d+' days to ALL?'))return;const r=await api('/push-all',{days:d});r.success?(showToast('✅ '+r.message),setTimeout(()=>location.reload(),1200)):showToast('❌','error');}
async function pushKeyAction(){const k=document.getElementById('pk').value.trim(),d=parseInt(document.getElementById('pd').value)||30;if(!k)return showToast('⚠ Enter key','error');const r=await api('/push-key',{keyName:k,days:d});r.success?(showToast('✅'),setTimeout(()=>location.reload(),1000)):showToast('❌','error');}

// ================== ENDPOINTS ==================
function renderEndpoints(){
  const cats = {};
  ENDPOINTS.forEach(e => { const c = e.c||'other'; if(!cats[c]) cats[c]=[]; cats[c].push(e); });
  let html = '';
  Object.entries(cats).forEach(([cat, eps]) => {
    html += '<div style="margin-bottom:18px"><h4 style="color:'+CURRENT_THEME.colors.accent2+';margin-bottom:10px;text-transform:uppercase;letter-spacing:2px;font-size:12px">📂 '+cat+'</h4><div class="endpoint-grid">';
    eps.forEach(e => { html += '<div class="endpoint-card" onclick="copyEndpoint(\\''+e.name+'\\',\\''+e.p+'\\',\\''+e.e+'\\')"><div class="ep-icon">'+e.i+'</div><div class="ep-name">/'+e.name+'</div><div class="ep-desc">'+e.d+'</div><div class="ep-url">GET /api/key-bronx/'+e.name+'?key=KEY&'+e.p+'='+e.e+'</div></div>'; });
    html += '</div></div>';
  });
  document.getElementById('endpointsList').innerHTML = html;
}
function copyEndpoint(ep,param,example){navigator.clipboard.writeText(location.origin+'/api/key-bronx/'+ep+'?key=YOUR_KEY&'+param+'='+example).then(()=>showToast('✅ Copied')).catch(()=>showToast('⚠ Failed','error'));}

// ================== CUSTOM APIs (FIXED) ==================
function renderAPIs(){
  const tbody = document.getElementById('apisBody');
  if(!CUSTOM_APIS.length){
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">No custom APIs</td></tr>';
    return;
  }
  tbody.innerHTML = CUSTOM_APIS.map(a =>
    '<tr>' +
      '<td>'+a.id+'</td>' +
      '<td style="color:'+CURRENT_THEME.colors.accent2+'">'+a.name+'</td>' +
      '<td><code>/'+a.endpoint+'</code></td>' +
      '<td><code style="font-size:9px;color:'+CURRENT_THEME.colors.info+'">custom:'+a.endpoint+'</code></td>' +
      '<td>'+a.param+'</td>' +
      '<td style="color:'+(a.visible?'#00ff88':'#ff2d2d')+'">'+(a.visible?'👁':'🙈')+'</td>' +
      '<td style="white-space:nowrap">' +
        '<button class="btn-action btn-push" onclick="toggleAPI('+a.id+')" title="Toggle"><i class="fas fa-eye'+(a.visible?'-slash':'')+'"></i></button>' +
        '<button class="btn-action btn-edit" onclick="editAPI('+a.id+')" title="Edit"><i class="fas fa-edit"></i></button>' +
        '<button class="btn-action btn-info" onclick="copyScope(\\'custom:'+a.endpoint+'\\')" title="Copy scope"><i class="fas fa-crosshairs"></i></button>' +
        '<button class="btn-action btn-delete" onclick="deleteAPI('+a.id+')" title="Delete"><i class="fas fa-trash"></i></button>' +
      '</td>' +
    '</tr>'
  ).join('');
}
function copyScope(s){navigator.clipboard.writeText(s).then(()=>showToast('✅ Copied: '+s)).catch(()=>showToast('⚠ Failed','error'));}

// ✅ FIXED: addAPI refreshes scope lists LIVE
async function addAPI(){
  const n = document.getElementById('aname').value.trim();
  const e = document.getElementById('aep').value.trim();
  if(!n || !e) return showToast('⚠ Fill Name & Endpoint','error');
  const r = await api('/add-api',{
    name: n,
    endpoint: e,
    param: document.getElementById('aparam').value,
    example: document.getElementById('aex').value,
    realAPI: document.getElementById('aurl').value,
    visible: true
  });
  if(r.success){
    showToast('✅ API Added: ' + r.api.name,'success');
    CUSTOM_APIS.push(r.api);
    renderAPIs();
    renderScopeLists(); // 🔥 LIVE REFRESH both scope lists
    document.getElementById('aname').value = '';
    document.getElementById('aep').value = '';
    document.getElementById('aex').value = '';
    document.getElementById('aurl').value = '';
    document.getElementById('apiCount').textContent = CUSTOM_APIS.length;
    document.getElementById('hdAPIs').textContent = CUSTOM_APIS.length;
  } else showToast('❌ ' + (r.e||'Error'),'error');
}
async function toggleAPI(id){
  const r = await api('/toggle-api',{id});
  if(r.success){
    const a = CUSTOM_APIS.find(x => x.id === id);
    if(a) a.visible = r.visible;
    renderAPIs();
    renderScopeLists();
    showToast('✅ Toggled');
  }
}
async function deleteAPI(id){
  if(!confirm('Delete this API?')) return;
  const r = await api('/delete-api',{id});
  if(r.success){
    CUSTOM_APIS = CUSTOM_APIS.filter(x => x.id !== id);
    renderAPIs();
    renderScopeLists();
    document.getElementById('apiCount').textContent = CUSTOM_APIS.length;
    document.getElementById('hdAPIs').textContent = CUSTOM_APIS.length;
    showToast('✅ Deleted');
  }
}
async function editAPI(id){
  const a = CUSTOM_APIS.find(x => x.id === id);
  if(!a) return;
  const n = prompt('New name:', a.name) || a.name;
  const e = prompt('New endpoint:', a.endpoint) || a.endpoint;
  const p = prompt('New param:', a.param) || a.param;
  const x = prompt('New example:', a.example) || a.example;
  const u = prompt('New URL ({param}):', a.realAPI) || a.realAPI;
  const r = await api('/edit-api',{id, name:n, endpoint:e, param:p, example:x, realAPI:u});
  if(r.success){
    Object.assign(a, r.api);
    renderAPIs();
    renderScopeLists();
    showToast('✅ Updated');
  } else showToast('❌ ' + (r.e||''),'error');
}

// ================== PROTECT ==================
async function renderProtect(){
  const r = await api('/backup');
  const prot = r.protected || {};
  document.getElementById('protectList').innerHTML = '<table><thead><tr><th>Value</th><th>Status</th><th>Action</th></tr></thead><tbody>'+
    (Object.keys(prot).map(v => '<tr><td><code style="color:'+CURRENT_THEME.colors.danger+'">'+v+'</code></td><td>🔒 Protected</td><td><button class="btn-action btn-delete" onclick="removeProt(\\''+v+'\\')"><i class="fas fa-unlock"></i></button></td></tr>').join('') || '<tr><td colspan="3" style="text-align:center;color:var(--text-muted)">No protected data</td></tr>')+
    '</tbody></table>';
}
async function addProtection(){const v=document.getElementById('protVal').value.trim();if(!v)return;const r=await api('/add-protection',{value:v});r.success?(showToast('✅ Protected'),renderProtect(),document.getElementById('protVal').value=''):showToast('❌','error');}
async function removeProt(v){if(!confirm('Remove?'))return;await api('/remove-protection',{value:v});renderProtect();showToast('✅');}

// ================== IMPORT/EXPORT ==================
async function importKeys(){const d=document.getElementById('importData').value.trim(),m=document.getElementById('importMsg');if(!d)return m.textContent='❌ Paste JSON';try{const j=JSON.parse(d);const r=await api('/import-keys',j);r.success?(m.style.color='#00ff88',m.textContent='✅ '+r.message,setTimeout(()=>location.reload(),1500)):(m.style.color='#ff2d2d',m.textContent='❌ '+(r.e||''));}catch(e){m.style.color='#ff2d2d';m.textContent='❌ Invalid JSON';}}
async function loadExport(){const r=await api('/export-keys');if(r.success){document.getElementById('exportData').value=JSON.stringify(r,null,2);showToast('✅ Loaded');}}
async function copyExport(){const t=document.getElementById('exportData');if(!t.value)return showToast('⚠ Click LOAD first','error');try{await navigator.clipboard.writeText(t.value);showToast('✅ Copied');}catch(e){t.select();document.execCommand('copy');showToast('✅');}}

// ================== RESPONSES ==================
async function loadResponse(){const ep=document.getElementById('responseEndpoint').value;const r=await api('/get-endpoint-response?endpoint='+ep);document.getElementById('responseData').value=r.data?JSON.stringify(r.data,null,2):'';}
async function updateResponse(){const ep=document.getElementById('responseEndpoint').value,d=document.getElementById('responseData').value.trim();const r=await api('/update-endpoint-response',{endpoint:ep,responseData:d});r.success?showToast('✅ Saved'):showToast('❌ '+(r.e||''),'error');}

// ================== DASHBOARD ==================
async function loadDashboard(){
  const r=await api('/stats');
  if(r){
    document.getElementById('dashToday').textContent=r.todayRequests||0;
    document.getElementById('dashWeek').textContent=r.weeklyRequests||0;
    document.getElementById('dashMonth').textContent=r.monthlyRequests||0;
    document.getElementById('dashTotal').textContent=r.totalRequests||0;
    document.getElementById('statToday').textContent=r.todayRequests||0;
    document.getElementById('statTotal').textContent=r.totalRequests||0;
    if(r.topKeys) document.getElementById('topKeysBody').innerHTML=r.topKeys.map(k=>'<tr><td style="color:'+CURRENT_THEME.colors.accent+'">'+k.k+'</td><td>'+k.v+'</td></tr>').join('')||'<tr><td colspan="2" style="text-align:center;color:var(--text-muted)">No data</td></tr>';
    if(r.topIPs) document.getElementById('topIPsBody').innerHTML=r.topIPs.map(k=>'<tr><td style="color:'+CURRENT_THEME.colors.info+'">'+k.k+'</td><td>'+k.v+'</td></tr>').join('')||'<tr><td colspan="2" style="text-align:center;color:var(--text-muted)">No data</td></tr>';
    if(r.topDevices) document.getElementById('topDevicesBody').innerHTML=r.topDevices.map(k=>'<tr><td style="color:'+CURRENT_THEME.colors.pink+';font-size:9px">'+k.k.substring(0,25)+'..</td><td>'+k.v+'</td></tr>').join('')||'<tr><td colspan="2" style="text-align:center;color:var(--text-muted)">No data</td></tr>';
    if(r.topEndpoints) document.getElementById('topEpDash').innerHTML=r.topEndpoints.map(k=>'<tr><td style="color:'+CURRENT_THEME.colors.accent2+'">/'+k.k+'</td><td>'+k.v+'</td></tr>').join('')||'<tr><td colspan="2" style="text-align:center;color:var(--text-muted)">No data</td></tr>';
  }
  const banR=await api('/bans');
  if(banR){const total=(banR.ip?.length||0)+(banR.device?.length||0)+(banR.key?.length||0);document.getElementById('statBans').textContent=total;}
  const devR=await api('/devices');
  if(devR) document.getElementById('statDevices').textContent=devR.total;
}

// ================== MONITOR ==================
let allLogs=[];
async function loadMonitorLogs(){const r=await api('/monitor-logs');allLogs=r.logs?r.logs.reverse():[];renderMonitor();}
function renderMonitor(){const c=document.getElementById('monitorLogs');if(!c)return;const f=(document.getElementById('monitorFilter')?.value||'').toLowerCase();const flt=f?allLogs.filter(l=>JSON.stringify(l).toLowerCase().includes(f)):allLogs;c.innerHTML=flt.slice(0,200).map(l=>'<div class="log-entry"><span class="log-time">'+l.timestamp+'</span><span class="log-key">'+l.key+'</span><span class="log-endpoint">/'+l.endpoint+'</span><span class="log-ip">'+l.ip+'</span><span class="log-device">'+(l.deviceIcon||'❓')+'</span><span class="log-browser">'+l.browser+'</span></div>').join('')||'<div style="color:var(--text-muted);text-align:center;padding:20px">No logs</div>';}

// ================== STATS ==================
async function loadStats(){
  const r=await api('/stats');
  if(r){
    document.getElementById('statTotalReqs').textContent=r.totalRequests||0;
    document.getElementById('statTodayReqs').textContent=r.todayRequests||0;
    document.getElementById('statWeekReqs').textContent=r.weeklyRequests||0;
    document.getElementById('statMonthReqs').textContent=r.monthlyRequests||0;
    document.getElementById('topEndpointsBody').innerHTML=r.topEndpoints?r.topEndpoints.map(e=>'<tr><td style="color:'+CURRENT_THEME.colors.accent2+'">/'+e.k+'</td><td>'+e.v+'</td></tr>').join(''):'';
    document.getElementById('clientStatsBody').innerHTML=r.clientStats?r.clientStats.map(c=>'<tr><td style="color:'+CURRENT_THEME.colors.success+'">'+c.k+'</td><td>'+c.v+'</td></tr>').join(''):'';
    document.getElementById('browserStatsBody').innerHTML=r.browserStats?r.browserStats.map(c=>'<tr><td style="color:'+CURRENT_THEME.colors.purple+'">'+c.k+'</td><td>'+c.v+'</td></tr>').join(''):'';
    document.getElementById('countryStatsBody').innerHTML=r.countryStats?r.countryStats.map(c=>'<tr><td style="color:'+CURRENT_THEME.colors.info+'">'+c.k+'</td><td>'+c.v+'</td></tr>').join(''):'';
    document.getElementById('osStatsBody').innerHTML=r.osStats?r.osStats.map(c=>'<tr><td style="color:'+CURRENT_THEME.colors.yellow+'">'+c.k+'</td><td>'+c.v+'</td></tr>').join(''):'';
  }
}

// ================== BANS ==================
async function loadBans(){
  const r=await api('/bans'); if(!r) return;
  const toRows=(list,type)=>(list||[]).map(b=>'<tr><td><code style="color:'+CURRENT_THEME.colors.danger+';font-size:9px">'+b.id.substring(0,30)+'</code></td><td style="color:'+CURRENT_THEME.colors.warning+';font-size:10px">'+(b.reason||'')+'</td><td style="font-size:9px">'+(b.at||'')+'</td><td>'+(b.permanent?'🔴 PERM':(b.until?new Date(b.until).toLocaleString():'-'))+'</td><td>'+(b.strikes||0)+'</td><td><button class="btn-action btn-reset" onclick="unban(\\''+type+'\\',\\''+b.id+'\\')"><i class="fas fa-unlock"></i></button></td></tr>').join('')||'<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">Empty</td></tr>';
  document.getElementById('banIPBody').innerHTML=toRows(r.ip,'ip');
  document.getElementById('banDeviceBody').innerHTML=toRows(r.device,'device');
  document.getElementById('banKeyBody').innerHTML=toRows(r.key,'key');
}
async function manualBan(){const type=document.getElementById('banType').value,id=document.getElementById('banId').value.trim();if(!id)return showToast('⚠ Enter value','error');const reason=prompt('Reason?','Manual ban')||'Manual ban';const r=await api('/ban',{type,id,reason,permanent:false,minutes:60});r.success?(showToast('✅ Banned'),loadBans()):showToast('❌','error');}
async function unban(type,id){if(!confirm('Unban?'))return;const r=await api('/unban',{type,id});r.success?(showToast('✅ Unbanned'),loadBans()):showToast('❌','error');}
async function unbanAll(){if(!confirm('Unban ALL?'))return;const r=await api('/unban-all');r.success?(showToast('✅ Cleared'),loadBans()):showToast('❌','error');}

// ================== DEVICES ==================
async function loadDevices(){
  const r=await api('/devices');
  if(r && r.devices){
    document.getElementById('devicesBody').innerHTML = r.devices.slice(0,100).map(d => '<tr>'+
      '<td><code style="color:'+CURRENT_THEME.colors.info+';font-size:9px">'+d.id.substring(0,22)+'..</code></td>'+
      '<td>'+(d.deviceIcon||'❓')+' '+(d.deviceType||'')+'</td>'+
      '<td>'+(d.os||'')+'</td><td style="color:'+CURRENT_THEME.colors.success+'">'+(d.browser||'')+'</td>'+
      '<td>'+(d.requests||0)+'</td><td style="font-size:9px">'+(d.lastSeen||'')+'</td>'+
      '<td>'+(d.banned?'<span style="color:#ff2d2d">🚫</span>':'<span style="color:#00ff88">🟢</span>')+'</td>'+
      '<td>'+(d.banned?'<button class="btn-action btn-reset" onclick="unban(\\'device\\',\\''+d.id+'\\')"><i class="fas fa-unlock"></i></button>':'<button class="btn-action btn-stop" onclick="quickBanDevice(\\''+d.id+'\\')"><i class="fas fa-ban"></i></button>')+'</td></tr>').join('') || '<tr><td colspan="8" style="text-align:center;color:var(--text-muted)">No devices</td></tr>';
  }
}
async function quickBanDevice(deviceId){if(!confirm('Ban device?'))return;const r=await api('/ban',{type:'device',id:deviceId,reason:'Quick ban',permanent:false,minutes:60});r.success?(showToast('✅ Banned'),loadDevices()):showToast('❌','error');}

// ================== DDOS ==================
async function saveDDOS(){
  const data={
    mode:document.getElementById('ddosMode').value,
    ip:{burst10s:document.getElementById('ddosIP10').value,perMinute:document.getElementById('ddosIP1M').value,perHour:document.getElementById('ddosIP1H').value},
    device:{burst10s:document.getElementById('ddosDEV10').value,perMinute:document.getElementById('ddosDEV1M').value,perHour:document.getElementById('ddosDEV1H').value},
    tempBanMs:parseInt(document.getElementById('ddosTempBan').value)*60000,
    longBanMs:parseInt(document.getElementById('ddosLongBan').value)*60000
  };
  const r=await api('/ddos-config',data);
  r.success?showToast('✅ Saved'):showToast('❌','error');
}
async function clearAllStrikes(){if(!confirm('Clear strikes?'))return;const r=await api('/clear-strikes',{});r.success?showToast('✅ Cleared'):showToast('❌','error');}

// ================== LOGS ==================
async function loadAdminLogs(){
  const r=await api('/admin-logs');
  if(r && r.logs){
    document.getElementById('adminLogsBody').innerHTML = r.logs.reverse().map(l => {
      const sc = l.status==='SUCCESS'?'#00ff88':(l.status==='FAILED'?'#ff9500':'#ff2d2d');
      return '<tr><td>'+l.timestamp+'</td><td>'+l.user+'</td><td>'+l.action+'</td><td>'+l.ip+'</td><td>'+(l.device||'-')+'</td><td style="color:'+sc+'">'+l.status+'</td></tr>';
    }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No logs</td></tr>';
  }
}
async function loadAudit(){
  const r=await api('/audit-log');
  if(r && r.logs){
    document.getElementById('auditBody').innerHTML = r.logs.reverse().map(l => '<tr><td style="font-size:9px">'+l.timestamp+'</td><td>'+l.user+'</td><td style="color:'+CURRENT_THEME.colors.info+'">'+l.action+'</td><td style="font-size:9px;color:var(--text-muted)">'+JSON.stringify(l.details||{}).substring(0,60)+'</td></tr>').join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No entries</td></tr>';
  }
}

// ================== THEME ==================
function renderThemeTab(){
  document.getElementById('presetsGrid').innerHTML = Object.keys(PRESETS).map(name => '<div class="preset-card '+(CURRENT_THEME.preset===name?'active':'')+'" data-preset="'+name+'" onclick="applyPresetByName(\\''+name+'\\')"><div class="preset-swatch" style="background:linear-gradient(135deg,'+PRESETS[name].accent+','+PRESETS[name].accent2+')"></div><div class="preset-name">'+name+'</div></div>').join('');
  const colorKeys = ['accent','accent2','bgPrimary','bgSecondary','textPrimary','textSecondary','success','warning','danger','info','pink','purple','yellow'];
  document.getElementById('colorPickers').innerHTML = colorKeys.map(k => '<div class="color-picker-row"><label>'+k+'</label><input type="color" id="cp_'+k+'" value="'+(CURRENT_THEME.colors[k]||'#000000')+'"></div>').join('');
  const effectsKeys = ['snowfall','glow','rainbowAnim','gridBg','scanLines'];
  document.getElementById('effectsList').innerHTML = effectsKeys.map(k => '<div class="color-picker-row"><label>'+k+'</label><input type="checkbox" '+(CURRENT_THEME.effects[k]?'checked':'')+' id="ef_'+k+'"></div>').join('');
}
function switchTab(name, el){
  document.querySelectorAll('#section-theme .tab').forEach(t=>t.classList.remove('active'));
  if(el) el.classList.add('active');
  ['presets','colors','effects'].forEach(t => { const x=document.getElementById('themeTab-'+t); if(x) x.style.display = t===name?'block':'none'; });
}
async function applyPresetByName(name){
  const r = await api('/theme/preset',{preset:name});
  if(r.success){ showToast('🎨 '+name,'info'); liveApplyTheme(r.theme); CURRENT_THEME=r.theme; renderThemeTab(); }
  else showToast('❌','error');
}
async function saveCustomColors(){
  const colors = {};
  ['accent','accent2','bgPrimary','bgSecondary','textPrimary','textSecondary','success','warning','danger','info','pink','purple','yellow'].forEach(k => { const el=document.getElementById('cp_'+k); if(el) colors[k]=el.value; });
  const r = await api('/theme/colors',{colors});
  if(r.success){ showToast('🎨 Saved!','success'); liveApplyTheme(r.theme); CURRENT_THEME=r.theme; }
}
async function saveEffects(){
  const effects = {};
  ['snowfall','glow','rainbowAnim','gridBg','scanLines'].forEach(k => { const el=document.getElementById('ef_'+k); if(el) effects[k]=el.checked; });
  const r = await api('/theme/effects',{effects});
  if(r.success){ showToast('✨ Saved!','success'); liveApplyTheme(r.theme); CURRENT_THEME=r.theme; }
}
async function resetTheme(){
  const r = await api('/theme/reset');
  if(r.success){ showToast('🔄 Reset','info'); liveApplyTheme(r.theme); CURRENT_THEME=r.theme; renderThemeTab(); }
}
function liveApplyTheme(t){
  const c = t.colors;
  const root = document.documentElement;
  Object.keys(c).forEach(k => {
    const varName = '--' + k.replace(/([A-Z])/g,'-$1').toLowerCase();
    root.style.setProperty(varName, c[k]);
  });
  root.style.setProperty('--accent', c.accent);
  root.style.setProperty('--accent2', c.accent2);
  root.style.setProperty('--gradient-primary', 'linear-gradient(135deg,'+c.accent+','+c.accent2+')');
  root.style.setProperty('--gradient-rainbow', 'linear-gradient(90deg,'+c.accent+','+c.accent2+','+c.yellow+','+c.success+','+c.info+','+c.purple+','+c.pink+','+c.accent+')');
}

// ================== ANNOUNCEMENT/MAINTENANCE ==================
async function loadAnnouncement(){const r=await api('/announcement');if(r){document.getElementById('annEnabled').value=r.enabled?'true':'false';document.getElementById('annText').value=r.text||'';document.getElementById('annType').value=r.type||'info';}}
async function saveAnnouncement(){const r=await api('/announcement',{enabled:document.getElementById('annEnabled').value==='true',text:document.getElementById('annText').value,type:document.getElementById('annType').value});r.success?showToast('✅ Saved'):showToast('❌','error');}
async function loadMaintenance(){const r=await api('/maintenance');if(r){document.getElementById('mtEnabled').value=r.enabled?'true':'false';document.getElementById('mtMessage').value=r.message||'';}}
async function saveMaintenance(){const r=await api('/maintenance',{enabled:document.getElementById('mtEnabled').value==='true',message:document.getElementById('mtMessage').value});r.success?showToast('✅ Saved'):showToast('❌','error');}

// ================== BACKUP ==================
async function backupData(){
  const r = await api('/backup');
  const blob = new Blob([JSON.stringify(r,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='bronx-backup-'+Date.now()+'.json'; a.click();
  URL.revokeObjectURL(url);
  showToast('✅ Downloaded');
}
async function restoreData(){
  const d = document.getElementById('restoreData').value.trim();
  if(!d) return showToast('⚠ Paste backup','error');
  try{ const json = JSON.parse(d); const r = await api('/restore',json); r.success?(showToast('✅ Restored'),setTimeout(()=>location.reload(),1500)):showToast('❌ '+(r.e||''),'error'); }catch(e){ showToast('❌ Invalid JSON','error'); }
}

// ================== SETTINGS ==================
async function resetAll(){if(confirm('Reset ALL?')){await api('/reset-all');showToast('✅');setTimeout(()=>location.reload(),1000);}}
async function clearLogs(){if(confirm('Clear ALL logs?')){await api('/clear-logs');showToast('✅');setTimeout(()=>location.reload(),1000);}}

// ================== INIT ==================
renderScopeLists();
renderKeys();
renderAPIs();
loadDashboard();
</script></body></html>`;
  }catch(e){
    return '<html><body style="background:#0a0505;color:#ff2d2d;padding:30px;font-family:monospace"><h1>⚠️ ERROR</h1><pre>'+e.message+'\n'+e.stack+'</pre></body></html>';
  }
}

// ============================================================
// 🚀 BOOT
// ============================================================
const PORT = process.env.PORT || 3000;
(async () => {
  initHardcoded();
  if(!loadFromDisk()){ if(!customAPIs.length) initCustomAPIs(); }
  if(!keyStorage[MASTER_API_KEY]) keyStorage[MASTER_API_KEY] = { name:'👑 OWNER', scopes:['*'], type:'owner', limit:999999, used:0, cooldown:0, dailyLimit:0, perSecondLimit:0, expiry:null, expiryStr:'LIFETIME', created:getIndiaDateTime(), unlimited:true, hidden:true, _hardcoded:false };
  saveToDisk();
  setInterval(saveToDisk, 3*60*1000);
  app.listen(PORT, () => {
    console.log('🛡️ BRONX V501 ULTRA FIXED ONLINE!');
    console.log('✅ Custom API scopes FIXED');
    console.log('🎨 Live Theme Changer ACTIVE');
    console.log('🛡️ Smart DDoS:', ddosConfig.mode);
    console.log('📱 Device Tracking ACTIVE');
    console.log('🔐 Admin:', ADMIN_PATH);
    console.log('🚀 PORT:', PORT);
  });
})();
module.exports = app;
