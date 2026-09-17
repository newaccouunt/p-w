// api/index.js - BRONX OSINT V300 NEON ULTRA - PROFESSIONAL EDITION
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const app = express();

const REAL_API_BASE = 'https://ft-osint-api.duckdns.org/api';
const REAL_API_KEYS = ['bronx-bot-9999', 'bronx-bot-9999', 'bronx-ultra-king-ft-bro-op', 'bronx-ultra-king-ft-bro-op'];
let currentKeyIndex = 0;
function getNextKey() { const key = REAL_API_KEYS[currentKeyIndex]; currentKeyIndex = (currentKeyIndex + 1) % REAL_API_KEYS.length; return key; }

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'bronx';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '85095613';
const MASTER_API_KEY = process.env.MASTER_API_KEY || 'BRONX_MASTER_' + Math.random().toString(36).substring(2,10).toUpperCase();
const ADMIN_PATH = '/bronx-admin-panel'; // New hidden admin path

const DATA_DIR = process.env.RENDER_DATA_DIR || '/tmp';
const DATA_FILE = path.join(DATA_DIR, 'bronx_v300_data.json');
const LOGS_FILE = path.join(DATA_DIR, 'bronx_v300_logs.json');
const ADMIN_LOGS_FILE = path.join(DATA_DIR, 'bronx_v300_admin_logs.json');
const BANNED_IPS_FILE = path.join(DATA_DIR, 'bronx_v300_banned_ips.json');
const BANNED_DEVICES_FILE = path.join(DATA_DIR, 'bronx_v300_banned_devices.json');
const RATE_LIMIT_FILE = path.join(DATA_DIR, 'bronx_v300_ratelimit.json');

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
let themeSettings = { neon: true };
let bannedIPs = {}; // {ip: {bannedAt, reason, banUntil}}
let bannedDevices = {}; // {deviceId: {bannedAt, reason, banUntil, fingerprint}}
let ipRequestTracker = {}; // {ip: {requests: [], blocked: false}}
let loginAttempts = {}; // {ip: {attempts, lastAttempt, banned}}
let deviceFingerprints = {}; // {deviceId: {lastSeen, requests, userAgent, ip}}
let ipRequestCounts = {}; // {ip: {count, date}}
let rateLimitConfig = {
    maxRequestsPer10Sec: 30,
    maxRequestsPerMinute: 100,
    maxRequestsPerHour: 500,
    loginAttemptsMax: 5,
    loginBanDuration: 3600000,
    autoBanDuration: 86400000
};

function saveToDisk(){
    try{
        const ks={};
        Object.entries(keyStorage).forEach(([k,v])=>{if(!v._hardcoded)ks[k]=v});
        const d={
            keys:ks, apis:customAPIs, tokens:permanentTokens, logs:requestLogs.slice(-1000), 
            protected:protectedData, endpointResponses, themeSettings, bannedIPs, bannedDevices,
            deviceFingerprints, rateLimitConfig
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(d,null,2));
        fs.writeFileSync(LOGS_FILE, JSON.stringify(keyMonitorLogs.slice(-500), null, 2));
        fs.writeFileSync(ADMIN_LOGS_FILE, JSON.stringify(adminLogs.slice(-200), null, 2));
        fs.writeFileSync(BANNED_IPS_FILE, JSON.stringify(bannedIPs, null, 2));
        fs.writeFileSync(BANNED_DEVICES_FILE, JSON.stringify(bannedDevices, null, 2));
    }catch(e){}
}

function loadFromDisk(){
    try{
        if(fs.existsSync(DATA_FILE)){
            const d=JSON.parse(fs.readFileSync(DATA_FILE,'utf8'));
            if(d.keys) Object.entries(d.keys).forEach(([k,v])=>{keyStorage[k]=v});
            if(d.apis?.length>0) customAPIs=d.apis;
            if(d.tokens){permanentTokens=d.tokens; Object.entries(permanentTokens).forEach(([t])=>{adminSessions[t]={expiresAt:Date.now()+(365*24*60*60*1000),permanent:true}})}
            if(d.logs) requestLogs=d.logs;
            if(d.protected) protectedData=d.protected;
            if(d.endpointResponses) endpointResponses=d.endpointResponses;
            if(d.themeSettings) themeSettings=d.themeSettings;
            if(d.bannedIPs) bannedIPs=d.bannedIPs;
            if(d.bannedDevices) bannedDevices=d.bannedDevices;
            if(d.deviceFingerprints) deviceFingerprints=d.deviceFingerprints;
            if(d.rateLimitConfig) rateLimitConfig={...rateLimitConfig,...d.rateLimitConfig};
        }
        if(fs.existsSync(LOGS_FILE)) keyMonitorLogs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8'));
        if(fs.existsSync(ADMIN_LOGS_FILE)) adminLogs = JSON.parse(fs.readFileSync(ADMIN_LOGS_FILE, 'utf8'));
        return true;
    }catch(e){}
    return false;
}

function scheduleSave(){setTimeout(()=>saveToDisk(),2000)}
setInterval(()=>scheduleSave(),5*60*1000);

function getIndiaTime(){return new Date(new Date().getTime()+(5.5*60*60*1000))}
function getIndiaDate(){return getIndiaTime().toISOString().split('T')[0]}
function getIndiaDateTime(){return getIndiaTime().toISOString().replace('T',' ').substring(0,19)}
function isKeyExpired(d){if(!d||d==='LIFETIME')return false;return getIndiaTime()>new Date(d)}
function parseExpiryDate(s){if(!s||s==='LIFETIME')return null;const p=s.split('-');if(p.length===3)return p[0].length===4?new Date(+p[0],+p[1]-1,+p[2],23,59,59):new Date(+p[2],+p[1]-1,+p[0],23,59,59);const d=new Date(s);return isNaN(d.getTime())?null:d}

// ========== DEVICE FINGERPRINTING ==========
function generateDeviceId(req) {
    const ua = req.headers['user-agent'] || '';
    const ip = getRealIP(req);
    const acceptLang = req.headers['accept-language'] || '';
    const acceptEnc = req.headers['accept-encoding'] || '';
    const platform = req.headers['sec-ch-ua-platform'] || '';
    const mobile = req.headers['sec-ch-ua-mobile'] || '';
    const raw = `${ua}|${acceptLang}|${acceptEnc}|${platform}|${mobile}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
        const char = raw.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return 'DEV_' + Math.abs(hash).toString(36).toUpperCase() + '_' + raw.length.toString(36).toUpperCase();
}

function detectDeviceType(req) {
    const ua = (req.headers['user-agent'] || '').toLowerCase();
    const platform = (req.headers['sec-ch-ua-platform'] || '').toLowerCase();
    
    // Mobile detection
    if (/iphone|ipad|ipod/.test(ua)) return { type: 'iPhone/iOS', icon: '📱', os: 'iOS' };
    if (/samsung|sm-/.test(ua)) return { type: 'Samsung', icon: '📱', os: 'Android' };
    if (/infinix/.test(ua)) return { type: 'Infinix', icon: '📱', os: 'Android' };
    if (/xiaomi|redmi|mi |poco/.test(ua)) return { type: 'Xiaomi/Redmi', icon: '📱', os: 'Android' };
    if (/oppo|cph/.test(ua)) return { type: 'Oppo', icon: '📱', os: 'Android' };
    if (/vivo/.test(ua)) return { type: 'Vivo', icon: '📱', os: 'Android' };
    if (/oneplus/.test(ua)) return { type: 'OnePlus', icon: '📱', os: 'Android' };
    if (/realme/.test(ua)) return { type: 'Realme', icon: '📱', os: 'Android' };
    if (/huawei|honor/.test(ua)) return { type: 'Huawei/Honor', icon: '📱', os: 'Android' };
    if (/android/.test(ua)) return { type: 'Android', icon: '📱', os: 'Android' };
    
    // Desktop detection
    if (/windows nt 10/.test(ua)) return { type: 'Windows 10/11', icon: '💻', os: 'Windows' };
    if (/windows nt/.test(ua)) return { type: 'Windows', icon: '💻', os: 'Windows' };
    if (/macintosh|mac os x/.test(ua)) return { type: 'MacBook/Mac', icon: '💻', os: 'macOS' };
    if (/linux/.test(ua)) return { type: 'Linux PC', icon: '💻', os: 'Linux' };
    if (/chrome os/.test(ua)) return { type: 'Chromebook', icon: '💻', os: 'ChromeOS' };
    
    // Bots/Tools
    if (/curl|wget|python|node|axios|java|php|ruby|go-http/.test(ua)) return { type: 'Bot/CLI Tool', icon: '🤖', os: 'Bot' };
    
    return { type: 'Unknown Device', icon: '❓', os: 'Unknown' };
}

function detectBrowser(req) {
    const ua = (req.headers['user-agent'] || '').toLowerCase();
    if (/edg\//.test(ua)) return 'Edge';
    if (/opr\/|opera/.test(ua)) return 'Opera';
    if (/chrome|crios/.test(ua) && !/edg|opr/.test(ua)) return 'Chrome';
    if (/firefox|fxios/.test(ua)) return 'Firefox';
    if (/safari/.test(ua) && !/chrome/.test(ua)) return 'Safari';
    if (/brave/.test(ua)) return 'Brave';
    if (/vivaldi/.test(ua)) return 'Vivaldi';
    if (/ucbrowser/.test(ua)) return 'UC Browser';
    if (/samsungbrowser/.test(ua)) return 'Samsung Internet';
    if (/postman/.test(ua)) return 'Postman';
    if (/insomnia/.test(ua)) return 'Insomnia';
    if (/curl/.test(ua)) return 'cURL';
    if (/python/.test(ua)) return 'Python';
    if (/node|axios/.test(ua)) return 'Node.js';
    if (/java/.test(ua)) return 'Java';
    if (/php/.test(ua)) return 'PHP';
    if (/go-http/.test(ua)) return 'Go';
    return 'Unknown';
}

// ========== DDOS PROTECTION ==========
function checkRateLimit(req) {
    const ip = getRealIP(req);
    const now = Date.now();
    
    if (!ipRequestTracker[ip]) {
        ipRequestTracker[ip] = { requests: [], blocked: false, lastReset: now };
    }
    
    const tracker = ipRequestTracker[ip];
    const tenSecAgo = now - 10000;
    const oneMinAgo = now - 60000;
    const oneHourAgo = now - 3600000;
    
    // Clean old requests
    tracker.requests = tracker.requests.filter(t => t > oneHourAgo);
    
    const reqs10s = tracker.requests.filter(t => t > tenSecAgo).length;
    const reqs1m = tracker.requests.filter(t => t > oneMinAgo).length;
    const reqs1h = tracker.requests.filter(t => t > oneHourAgo).length;
    
    // Check limits
    if (reqs10s >= rateLimitConfig.maxRequestsPer10Sec) {
        return { allowed: false, reason: `DDOS: ${reqs10s} requests in 10s (max ${rateLimitConfig.maxRequestsPer10Sec})`, autoBan: true };
    }
    if (reqs1m >= rateLimitConfig.maxRequestsPerMinute) {
        return { allowed: false, reason: `Rate limit: ${reqs1m} requests/min (max ${rateLimitConfig.maxRequestsPerMinute})`, autoBan: true };
    }
    if (reqs1h >= rateLimitConfig.maxRequestsPerHour) {
        return { allowed: false, reason: `Rate limit: ${reqs1h} requests/hour (max ${rateLimitConfig.maxRequestsPerHour})`, autoBan: false };
    }
    
    tracker.requests.push(now);
    return { allowed: true, reqs10s, reqs1m, reqs1h };
}

function isIPBanned(ip) {
    const ban = bannedIPs[ip];
    if (!ban) return false;
    if (ban.banUntil === 'PERMANENT') return true;
    if (Date.now() < ban.banUntil) return true;
    delete bannedIPs[ip];
    return false;
}

function isDeviceBanned(deviceId) {
    const ban = bannedDevices[deviceId];
    if (!ban) return false;
    if (ban.banUntil === 'PERMANENT') return true;
    if (Date.now() < ban.banUntil) return true;
    delete bannedDevices[deviceId];
    return false;
}

function autoBanIP(ip, reason, duration = null) {
    bannedIPs[ip] = {
        bannedAt: getIndiaDateTime(),
        reason: reason,
        banUntil: duration === 'PERMANENT' ? 'PERMANENT' : Date.now() + (duration || rateLimitConfig.autoBanDuration)
    };
    saveToDisk();
}

function checkLoginAttempts(ip) {
    const now = Date.now();
    if (!loginAttempts[ip]) {
        loginAttempts[ip] = { attempts: 0, lastAttempt: now, banned: false, bannedUntil: 0 };
    }
    const la = loginAttempts[ip];
    
    if (la.banned && now < la.bannedUntil) {
        return { allowed: false, remaining: Math.ceil((la.bannedUntil - now) / 1000) };
    }
    if (la.banned && now >= la.bannedUntil) {
        la.banned = false;
        la.attempts = 0;
    }
    return { allowed: true, attempts: la.attempts };
}

function recordFailedLogin(ip, username) {
    if (!loginAttempts[ip]) {
        loginAttempts[ip] = { attempts: 0, lastAttempt: Date.now(), banned: false, bannedUntil: 0 };
    }
    const la = loginAttempts[ip];
    la.attempts++;
    la.lastAttempt = Date.now();
    
    if (la.attempts >= rateLimitConfig.loginAttemptsMax) {
        la.banned = true;
        la.bannedUntil = Date.now() + rateLimitConfig.loginBanDuration;
        autoBanIP(ip, `Auto-banned: ${la.attempts} failed login attempts`, rateLimitConfig.loginBanDuration);
        adminLogs.push({
            user: username || 'unknown',
            action: 'AUTO_BAN',
            ip: ip,
            browser: 'N/A',
            timestamp: getIndiaDateTime(),
            status: 'BANNED'
        });
    }
    return la;
}

// ========== KEY VALIDATION ==========
function checkCooldown(k){
    const kd=keyStorage[k];
    if(!kd||!kd.cooldown)return{allowed:true};
    const n=Date.now();
    if(cooldownTimers[k]&&(n-cooldownTimers[k])<(kd.cooldown*1000))return{allowed:false,remaining:Math.ceil((kd.cooldown*1000-(n-cooldownTimers[k]))/1000)};
    cooldownTimers[k]=n;
    return{allowed:true}
}

function checkPerSecondLimit(k){
    const kd=keyStorage[k];
    if(!kd||!kd.perSecondLimit||kd.perSecondLimit<=0)return{allowed:true};
    const now = Date.now();
    const windowKey = k + '_ps_' + Math.floor(now / 1000);
    if(!perSecondLimits[windowKey]) perSecondLimits[windowKey] = 0;
    if(perSecondLimits[windowKey] >= kd.perSecondLimit) return {allowed:false, message: `⚡ Rate Limit ${kd.perSecondLimit}/s Reached!`};
    perSecondLimits[windowKey]++;
    return {allowed:true};
}

function checkDailyLimit(k){
    const kd=keyStorage[k];
    if(!kd||!kd.dailyLimit)return{allowed:true};
    const today=getIndiaDate();
    const dk=k+'_'+today;
    if(!dailyLimits[dk])dailyLimits[dk]=0;
    if(dailyLimits[dk]>=kd.dailyLimit)return{allowed:false,remaining:0,message:`🔴 Daily Limit ${kd.dailyLimit}/${kd.dailyLimit} Reached!`};
    return{allowed:true,used:dailyLimits[dk],remaining:kd.dailyLimit-dailyLimits[dk]}
}

function isProtected(value){
    for(const key in protectedData){
        if(value.includes(protectedData[key]))return protectedData[key]
    }
    return null
}

function checkKeyValid(k){
    if(!k)return{valid:false,error:'Missing key'};
    const kd=keyStorage[k];
    if(!kd)return{valid:false,error:'🔑 Key Not Found!\n\n🛒 Purchase Paid API Key\n📅 30 Days = ₹300\n👑 Lifetime = ₹5000\n\n💬 DM @BRONX_ULTRA on Telegram'};
    if(kd.stopped)return{valid:false,error:'⛔ Key Stopped!'};
    if(kd.disabled)return{valid:false,error:'🚫 Key Disabled by Admin!'};
    if(kd.expiry&&isKeyExpired(kd.expiry))return{valid:false,error:'⏰ Key Expired on '+kd.expiryStr};
    if(!kd.unlimited&&kd.used>=kd.limit)return{valid:false,error:`🔴 Key limit Reached ${kd.limit}/${kd.limit} so please Contact Owner And new @BRONX_ULTRA`};
    const dl=checkDailyLimit(k);
    if(!dl.allowed)return{valid:false,error:dl.message};
    const ps=checkPerSecondLimit(k);
    if(!ps.allowed)return{valid:false,error:ps.message};
    const cd=checkCooldown(k);
    if(!cd.allowed)return{valid:false,error:'⏱️ Cooldown '+cd.remaining+'s'};
    return{valid:true,keyData:kd}
}

function getRealIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0].trim() || 
           req.headers['x-real-ip'] || 
           req.headers['cf-connecting-ip'] ||
           req.connection.remoteAddress || 
           req.socket.remoteAddress || 
           'Unknown';
}

function detectClient(req) {
    const ua = req.headers['user-agent'] || '';
    if (ua.includes('python')) return 'Python';
    if (ua.includes('node')) return 'Node.js';
    if (ua.includes('axios')) return 'Node.js (Axios)';
    if (ua.includes('curl')) return 'cURL';
    if (ua.includes('java')) return 'Java';
    if (ua.includes('php')) return 'PHP';
    if (ua.includes('ruby')) return 'Ruby';
    if (ua.includes('go')) return 'Go';
    if (ua.includes('fetch')) return 'JavaScript (Fetch)';
    if (ua.includes('postman')) return 'Postman';
    if (ua.includes('insomnia')) return 'Insomnia';
    if (ua.includes('Mozilla')) return 'Browser';
    return 'Unknown';
}

function incrementKeyUsage(k, ep, req){
    const realIP = getRealIP(req);
    const clientType = detectClient(req);
    const deviceId = generateDeviceId(req);
    const deviceInfo = detectDeviceType(req);
    const browser = detectBrowser(req);
    
    if(keyStorage[k]&&!keyStorage[k].unlimited){
        keyStorage[k].used++;
        const dk=k+'_'+getIndiaDate();
        if(!dailyLimits[dk])dailyLimits[dk]=0;
        dailyLimits[dk]++;
        if(keyStorage[k].used%5===0)scheduleSave();
    }
    
    // Track device fingerprint
    if (!deviceFingerprints[deviceId]) {
        deviceFingerprints[deviceId] = {
            firstSeen: getIndiaDateTime(),
            lastSeen: getIndiaDateTime(),
            requests: 0,
            userAgent: req.headers['user-agent'] || 'Unknown',
            browser: browser,
            deviceType: deviceInfo.type,
            deviceIcon: deviceInfo.icon,
            os: deviceInfo.os,
            ips: []
        };
    }
    deviceFingerprints[deviceId].lastSeen = getIndiaDateTime();
    deviceFingerprints[deviceId].requests++;
    if (!deviceFingerprints[deviceId].ips.includes(realIP)) {
        deviceFingerprints[deviceId].ips.push(realIP);
        if (deviceFingerprints[deviceId].ips.length > 10) {
            deviceFingerprints[deviceId].ips = deviceFingerprints[deviceId].ips.slice(-10);
        }
    }
    
    // Track IP request counts
    if (!ipRequestCounts[realIP]) {
        ipRequestCounts[realIP] = { count: 0, date: getIndiaDate() };
    }
    if (ipRequestCounts[realIP].date !== getIndiaDate()) {
        ipRequestCounts[realIP] = { count: 0, date: getIndiaDate() };
    }
    ipRequestCounts[realIP].count++;
    
    keyMonitorLogs.push({
        key: k.substring(0, 8) + '***',
        fullKey: k,
        endpoint: ep,
        ip: realIP,
        deviceId: deviceId,
        deviceIcon: deviceInfo.icon,
        deviceType: deviceInfo.type,
        browser: browser,
        clientType: clientType,
        timestamp: getIndiaDateTime(),
        date: getIndiaDate()
    });
    if(keyMonitorLogs.length > 1000) keyMonitorLogs = keyMonitorLogs.slice(-1000);
}

function checkKeyScope(kd,ep){
    if(!kd?.scopes?.length)return{valid:false,error:'No scopes'};
    if(kd.scopes.includes('*'))return{valid:true};
    if(kd.scopes.includes(ep))return{valid:true};
    if(ep.startsWith('c/')&&kd.scopes.includes('custom:'+ep.substring(2)))return{valid:true};
    if(ep.startsWith('c/')&&kd.scopes.includes('custom'))return{valid:true};
    const isCustom=customAPIs.some(a=>a.endpoint===ep||'c/'+a.endpoint===ep);
    if(isCustom&&kd.scopes.includes('custom:'+ep))return{valid:true};
    return{valid:false,error:`Scope denied. Required: ${ep}`}
}

function generateToken(){const c='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';let t='';for(let i=0;i<32;i++)t+=c.charAt(Math.floor(Math.random()*c.length));return t}

function generateRandomKey(prefix = 'BRONX') {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let rand = '';
    for (let i = 0; i < 20; i++) rand += chars.charAt(Math.floor(Math.random() * chars.length));
    return `${prefix}_${rand}`;
}

function isAdminAuth(t){
    if(!t)return false;
    if(adminSessions[t]){
        if(adminSessions[t].permanent)return true;
        if(Date.now()<adminSessions[t].expiresAt)return true;
        delete adminSessions[t];
        delete permanentTokens[t];
    }
    return false;
}

function sanitizeResponse(d){
    if(!d)return d;
    try{
        const c=JSON.parse(JSON.stringify(d));
        delete c.credit;delete c.truecaller_name;delete c.cached;delete c.cached_at;
        delete c.api_by;delete c.by;delete c.channel;delete c.developer;
        delete c.api_key;delete c.real_url;delete c.source_url;delete c.owner;
        delete c.key_note;delete c.response_time_ms;
        if(c.meta){delete c.meta.api_by;delete c.meta.response_time_ms;delete c.meta.quota_used;if(Object.keys(c.meta).length===0)delete c.meta}
        c.powered_by="@BRONX_ULTRA";
        return c;
    }catch(e){return d}
}

function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}

function createMasterKey(){return{name:'👑 OWNER',scopes:['*'],type:'owner',limit:999999,used:0,cooldown:0,dailyLimit:0,perSecondLimit:0,expiry:null,expiryStr:'LIFETIME',created:getIndiaDateTime(),unlimited:true,hidden:true,_hardcoded:false}}

function initHardcodedKeys(){
    const now=getIndiaDateTime();
    const hc=[
        {key:'BRONX_PREMIUM_V100_01',name:'Premium 01',limit:999999,expiry:'31-12-2028',scopes:['*']},
        {key:'BRONX_PREMIUM_V100_02',name:'Premium 02',limit:999999,expiry:'31-12-2028',scopes:['*']},
        {key:'BRONX_PREMIUM_V100_03',name:'Premium 03',limit:999999,expiry:'31-12-2028',scopes:['*']},
        {key:'BRONX_PREMIUM_V100_04',name:'Premium 04',limit:999999,expiry:'31-12-2028',scopes:['*']},
        {key:'BRONX_PREMIUM_V100_05',name:'Premium 05',limit:999999,expiry:'31-12-2028',scopes:['*']},
        {key:'BRONX_ULTRA_OSINT_01',name:'Ultra 01',limit:888888,expiry:'30-06-2029',scopes:['number','aadhar','upi','pan']},
        {key:'BRONX_ULTRA_OSINT_02',name:'Ultra 02',limit:888888,expiry:'30-06-2029',scopes:['number','aadhar','upi','pan']},
        {key:'BRONX_KING_OP_V100',name:'King OP',limit:999999,expiry:'31-12-2030',scopes:['*']},
        {key:'BRONX_ELITE_V100_01',name:'Elite 01',limit:999999,expiry:'31-12-2030',scopes:['*']},
        {key:'BRONX_GOD_TIER_V100',name:'God Tier',limit:999999,expiry:'31-12-2030',scopes:['*']}
    ];
    hc.forEach(d=>{
        if(!keyStorage[d.key])keyStorage[d.key]={
            name:d.name,scopes:d.scopes,type:'hardcoded',limit:d.limit,used:0,
            cooldown:0,dailyLimit:0,perSecondLimit:0,
            expiry:parseExpiryDate(d.expiry),expiryStr:d.expiry,
            created:now,unlimited:true,hidden:true,_hardcoded:true
        }
    });
}

function initCustomAPIs(){
    customAPIs=[
        {id:1,name:'Number Info',endpoint:'number-advanced',param:'num',example:'9876543210',visible:true,realAPI:'https://num-tg-info-api.vercel.app/info?number={param}'},
        {id:2,name:'Vehicle RC',endpoint:'rc-details',param:'ca_number',example:'MH02FZ0555',visible:true,realAPI:'https://simple-rc-info.vercel.app/rc?num={param}'},
        {id:3,name:'Aadhar',endpoint:'aadhar-verify',param:'aadhar',example:'393933081942',visible:true,realAPI:'https://bronx-king-vip999.vercel.app/api/aadhaar?num={param}'},
        {id:4,name:'Email',endpoint:'email-lookup',param:'mail',example:'user@gmail.com',visible:true,realAPI:'https://bronx-king-mail-opi.vercel.app/mail={param}'},
        {id:5,name:'Telegram',endpoint:'telegram-scan',param:'id',example:'7530266953',visible:true,realAPI:'https://bronx-tg-king-bro.vercel.app/tg?key=BRONXop&query={param}'},
        {id:6,name:'SMS Bomber',endpoint:'sms-bomber',param:'number',example:'1234567890',visible:true,realAPI:'https://bronx-sms-api-ulimate.vercel.app/api/key-bronx-paid-vip?number={param}&counter=10'},
        {id:7,name:'Number Backup',endpoint:'num-op',param:'num',example:'9876543210',visible:true,realAPI:'https://tfqdeadlo-inddataapi.hf.space/search?mobile={param}'}
    ];
}

const endpoints={
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

app.use(express.json({limit:'50mb'}));
app.use(express.urlencoded({extended:true,limit:'50mb'}));
app.set('json spaces',2);

app.use((req,res,next)=>{
    res.setHeader('Access-Control-Allow-Origin','*');
    res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Content-Type,x-api-key,x-admin-token');
    if(req.method==='OPTIONS')return res.status(200).end();
    next();
});

// Global IP/Device ban check middleware for API routes
app.use('/api', (req, res, next) => {
    const ip = getRealIP(req);
    if (isIPBanned(ip)) {
        return res.status(403).json({ error: '🚫 Your IP is BANNED! Contact @BRONX_ULTRA' });
    }
    const deviceId = generateDeviceId(req);
    if (isDeviceBanned(deviceId)) {
        return res.status(403).json({ error: '🚫 Your DEVICE is BANNED! Contact @BRONX_ULTRA' });
    }
    const rl = checkRateLimit(req);
    if (!rl.allowed) {
        if (rl.autoBan) autoBanIP(ip, rl.reason, 'PERMANENT');
        return res.status(429).json({ error: '🛑 ' + rl.reason, banned: rl.autoBan });
    }
    next();
});

app.get('/',(req,res)=>{try{res.send(renderHome())}catch(e){res.send('Error loading homepage')}});
app.get('/test',(req,res)=>{res.json({status:'✅ BRONX V300 NEON ULTRA',storage:'RENDER DISK',endpoints:Object.keys(endpoints).length,total_keys:Object.keys(keyStorage).length,custom_apis:customAPIs.length,banned_ips:Object.keys(bannedIPs).length,banned_devices:Object.keys(bannedDevices).length})});

app.get('/api/leakinfo',async(req,res)=>{
    try{
        const t=req.query.term||req.query.info;
        if(!t)return res.json({error:'Missing term'});
        const prot=isProtected(t);
        if(prot)return res.json({error:'🔒 PROTECTED',protected:true});
        const r=await axios.get(`${REAL_API_BASE}/leakinfo?key=${getNextKey()}&info=${encodeURIComponent(t)}`,{timeout:30000});
        res.json({...sanitizeResponse(r.data),api_info:{endpoint:'leakinfo'}});
    }catch(e){res.json({error:'API error'})}
});

app.get('/api/custom/:ep',async(req,res)=>{
    try{
        const api=customAPIs.find(a=>a.endpoint===req.params.ep&&a.visible);
        if(!api)return res.json({error:'Not found'});
        const key=req.query.key;
        if(!key)return res.json({error:'Key required'});
        const kc=checkKeyValid(key);
        if(!kc.valid)return res.json({error:kc.error});
        const sc=checkKeyScope(kc.keyData,req.params.ep);
        if(!sc.valid)return res.json({error:sc.error});
        const pv=req.query[api.param]||req.query.number;
        if(!pv)return res.json({error:'Missing param'});
        const prot=isProtected(pv);
        if(prot)return res.json({error:'🔒 PROTECTED',protected:true});
        let url=api.realAPI.replace(/\{param\}/gi,encodeURIComponent(pv));
        const r=await axios.get(url,{timeout:30000});
        incrementKeyUsage(key, req.params.ep, req);
        requestLogs.push({timestamp:getIndiaDateTime(),key:key.substring(0,8)+'***',endpoint:'c/'+req.params.ep,param:pv.substring(0,20),status:'success',ip:getRealIP(req),clientType:detectClient(req)});
        if(requestLogs.length>1000)requestLogs=requestLogs.slice(-1000);
        res.json({...sanitizeResponse(r.data),api_info:{key_owner:kc.keyData?.name,remaining:kc.keyData?.unlimited?'∞':Math.max(0,(kc.keyData?.limit||0)-(kc.keyData?.used||0)),dailyRemaining:kc.keyData?.dailyLimit?Math.max(0,kc.keyData.dailyLimit-(dailyLimits[key+'_'+getIndiaDate()]||0)):'∞',limit:kc.keyData?.unlimited?'∞':kc.keyData?.limit,used:kc.keyData?.used||0,perSecondLimit:kc.keyData?.perSecondLimit||'∞',created:kc.keyData?.created,expiry:kc.keyData?.expiryStr||'LIFETIME'}});
    }catch(e){res.json({error:'API error'})}
});

app.get('/api/number',async(req,res)=>{
    try{
        const key=req.query.key;
        const num=req.query.num;
        if(!key)return res.json({error:'Key required'});
        if(!num)return res.json({error:'Missing num param'});
        const kc=checkKeyValid(key);
        if(!kc.valid)return res.json({error:kc.error});
        const sc=checkKeyScope(kc.keyData,'number');
        if(!sc.valid)return res.json({error:sc.error});
        const prot=isProtected(num);
        if(prot)return res.json({error:'🔒 PROTECTED',protected:true});
        const url=`${REAL_API_BASE}/number?key=${getNextKey()}&num=${encodeURIComponent(num)}`;
        const r=await axios.get(url,{timeout:30000});
        incrementKeyUsage(key, 'number', req);
        requestLogs.push({timestamp:getIndiaDateTime(),key:key.substring(0,8)+'***',endpoint:'number',param:num,status:'success',ip:getRealIP(req),clientType:detectClient(req)});
        if(requestLogs.length>1000)requestLogs=requestLogs.slice(-1000);
        res.json({...sanitizeResponse(r.data),api_info:{key_owner:kc.keyData?.name,remaining:kc.keyData?.unlimited?'∞':Math.max(0,(kc.keyData?.limit||0)-(kc.keyData?.used||0)),dailyRemaining:kc.keyData?.dailyLimit?Math.max(0,kc.keyData.dailyLimit-(dailyLimits[key+'_'+getIndiaDate()]||0)):'∞',limit:kc.keyData?.unlimited?'∞':kc.keyData?.limit,used:kc.keyData?.used||0,perSecondLimit:kc.keyData?.perSecondLimit||'∞',created:kc.keyData?.created,expiry:kc.keyData?.expiryStr||'LIFETIME'}});
    }catch(e){res.json({error:'API error'})}
});

app.get('/api/key-bronx/:ep',async(req,res)=>{
    try{
        const ep=req.params.ep;
        if(!endpoints[ep])return res.json({error:'Endpoint not found'});
        const key=req.query.key;
        if(!key)return res.json({error:'Key required'});
        const kc=checkKeyValid(key);
        if(!kc.valid)return res.json({error:kc.error});
        const sc=checkKeyScope(kc.keyData,ep);
        if(!sc.valid)return res.json({error:sc.error});
        const pv=req.query[endpoints[ep].p];
        if(!pv)return res.json({error:'Missing '+endpoints[ep].p});
        const prot=isProtected(pv);
        if(prot)return res.json({error:'🔒 '+ep+' PROTECTED',protected:true});
        const url=`${REAL_API_BASE}/${ep}?key=${getNextKey()}&${endpoints[ep].p}=${encodeURIComponent(pv)}`;
        const r=await axios.get(url,{timeout:30000});
        incrementKeyUsage(key, ep, req);
        requestLogs.push({timestamp:getIndiaDateTime(),key:key.substring(0,8)+'***',endpoint:ep,param:pv,status:'success',ip:getRealIP(req),clientType:detectClient(req)});
        if(requestLogs.length>1000)requestLogs=requestLogs.slice(-1000);
        res.json({...sanitizeResponse(r.data),api_info:{key_owner:kc.keyData?.name,remaining:kc.keyData?.unlimited?'∞':Math.max(0,(kc.keyData?.limit||0)-(kc.keyData?.used||0)),dailyRemaining:kc.keyData?.dailyLimit?Math.max(0,kc.keyData.dailyLimit-(dailyLimits[key+'_'+getIndiaDate()]||0)):'∞',limit:kc.keyData?.unlimited?'∞':kc.keyData?.limit,used:kc.keyData?.used||0,perSecondLimit:kc.keyData?.perSecondLimit||'∞',created:kc.keyData?.created,expiry:kc.keyData?.expiryStr||'LIFETIME'}});
    }catch(e){res.json({error:'API error'})}
});

// ========== HIDDEN ADMIN ROUTES ==========
app.get(ADMIN_PATH,(req,res)=>{
    try{
        const token=req.query.token||req.headers['x-admin-token'];
        if(token&&isAdminAuth(token))return res.send(renderAdmin(token));
        res.send(renderLogin());
    }catch(e){res.send('Error loading admin')}
});

app.post(ADMIN_PATH+'/login',async(req,res)=>{
    const{username,password}=req.body;
    const ip = getRealIP(req);
    const browser = req.headers['user-agent'] || 'Unknown';
    const deviceId = generateDeviceId(req);
    const deviceInfo = detectDeviceType(req);
    
    // Check if IP is banned
    if (isIPBanned(ip)) {
        adminLogs.push({user: username,action: 'LOGIN_BLOCKED_BANNED',ip: ip,browser: browser,timestamp: getIndiaDateTime(),status: 'BANNED'});
        return res.json({success:false,error:'🚫 Your IP is BANNED! Wait or contact owner.'});
    }
    
    // Check login attempts
    const la = checkLoginAttempts(ip);
    if (!la.allowed) {
        adminLogs.push({user: username,action: 'LOGIN_RATE_LIMITED',ip: ip,browser: browser,timestamp: getIndiaDateTime(),status: 'BLOCKED'});
        return res.json({success:false,error:`🛑 Too many attempts. Try again in ${la.remaining}s`});
    }
    
    if(username===ADMIN_USERNAME&&password===ADMIN_PASSWORD){
        const token=generateToken();
        adminSessions[token]={expiresAt:Date.now()+(365*24*60*60*1000),permanent:true};
        permanentTokens[token]={createdAt:getIndiaDateTime()};
        loginAttempts[ip] = { attempts: 0, lastAttempt: Date.now(), banned: false, bannedUntil: 0 };
        adminLogs.push({user: username,action: 'LOGIN',ip: ip,browser: browser,device: deviceInfo.type,timestamp: getIndiaDateTime(),status: 'SUCCESS'});
        scheduleSave();
        res.json({success:true,token,message:'✅ Access Granted',redirect:ADMIN_PATH+'?token='+token});
    } else {
        const failed = recordFailedLogin(ip, username);
        adminLogs.push({user: username,action: 'LOGIN_FAILED',ip: ip,browser: browser,device: deviceInfo.type,attempts: failed.attempts,timestamp: getIndiaDateTime(),status: 'FAILED'});
        const remaining = rateLimitConfig.loginAttemptsMax - failed.attempts;
        res.json({success:false,error:`Invalid credentials! ${remaining} attempts left.${failed.banned?' 🚫 IP BANNED!':''}`});
    }
});

// ========== ADMIN API ENDPOINTS ==========
app.post(ADMIN_PATH+'/generate-key',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
    const{keyName,keyOwner,scopes,limit,expiryDate,days,cooldown,dailyLimit,perSecondLimit,autoGenerate}=req.body;
    let finalKeyName = keyName;
    if (autoGenerate || !keyName) {
        finalKeyName = generateRandomKey();
    }
    if(!finalKeyName||!keyOwner)return res.json({e:'Missing fields'});
    if(keyStorage[finalKeyName])return res.json({e:'Key already exists'});
    const ks=scopes||['number'];
    let exp=null,es=expiryDate||'LIFETIME';
    if(days&&!isNaN(days)){
        const d=new Date(getIndiaTime().getTime()+parseInt(days)*24*60*60*1000);
        exp=d;
        es=d.toISOString().split('T')[0].split('-').reverse().join('-');
    }else if(expiryDate&&expiryDate!=='LIFETIME'){
        exp=parseExpiryDate(expiryDate);
        es=expiryDate;
    }
    keyStorage[finalKeyName]={
        name:keyOwner,scopes:ks,type:'generated',limit:parseInt(limit)||100,used:0,
        cooldown:parseInt(cooldown)||0,dailyLimit:parseInt(dailyLimit)||0,
        perSecondLimit:parseInt(perSecondLimit)||0,expiry:exp,expiryStr:es,
        created:getIndiaDateTime(),unlimited:false,hidden:false,_hardcoded:false,
        stopped:false,disabled:false
    };
    saveToDisk();
    res.json({success:true,key:finalKeyName,scopes:ks,cooldown:(parseInt(cooldown)||0)+'s',dailyLimit:dailyLimit||'Unlimited',perSecondLimit:perSecondLimit||'Unlimited',expiry:es,message:'🔑 Key Generated!'});
});

app.post(ADMIN_PATH+'/edit-key',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
    const{keyName,newName,newOwner,newLimit,newDailyLimit,newPerSecondLimit,newCooldown,newScopes}=req.body;
    if(!keyStorage[keyName])return res.json({e:'Key not found'});
    if(keyStorage[keyName]._hardcoded)return res.json({e:'Cannot edit hardcoded key'});
    const kd = keyStorage[keyName];
    if(newName && newName !== keyName){
        if(keyStorage[newName])return res.json({e:'New key name already exists'});
        keyStorage[newName] = {...kd};
        delete keyStorage[keyName];
        keyStorage[newName].name = newOwner || kd.name;
        keyStorage[newName].limit = newLimit ? parseInt(newLimit) : kd.limit;
        keyStorage[newName].dailyLimit = newDailyLimit !== undefined ? parseInt(newDailyLimit) : kd.dailyLimit;
        keyStorage[newName].perSecondLimit = newPerSecondLimit !== undefined ? parseInt(newPerSecondLimit) : kd.perSecondLimit;
        keyStorage[newName].cooldown = newCooldown !== undefined ? parseInt(newCooldown) : kd.cooldown;
        keyStorage[newName].scopes = newScopes || kd.scopes;
    } else {
        kd.name = newOwner || kd.name;
        kd.limit = newLimit ? parseInt(newLimit) : kd.limit;
        kd.dailyLimit = newDailyLimit !== undefined ? parseInt(newDailyLimit) : kd.dailyLimit;
        kd.perSecondLimit = newPerSecondLimit !== undefined ? parseInt(newPerSecondLimit) : kd.perSecondLimit;
        kd.cooldown = newCooldown !== undefined ? parseInt(newCooldown) : kd.cooldown;
        kd.scopes = newScopes || kd.scopes;
    }
    saveToDisk();
    res.json({success:true,message:'✅ Key updated!'});
});

app.post(ADMIN_PATH+'/push-key',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
    const{keyName,days}=req.body;
    if(!keyStorage[keyName])return res.json({e:'Key not found'});
    if(keyStorage[keyName]._hardcoded)return res.json({e:'Cannot push hardcoded key'});
    const d=parseInt(days)||30;
    const ne=new Date(getIndiaTime().getTime()+d*24*60*60*1000);
    keyStorage[keyName].expiry=ne;
    keyStorage[keyName].expiryStr=ne.toISOString().split('T')[0].split('-').reverse().join('-');
    keyStorage[keyName].used=0;
    saveToDisk();
    res.json({success:true,message:`⬆ Pushed ${d} days!`});
});

app.post(ADMIN_PATH+'/delete-key',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
    if(req.body.keyName===MASTER_API_KEY||keyStorage[req.body.keyName]?._hardcoded)return res.json({e:'Protected key'});
    delete keyStorage[req.body.keyName];
    saveToDisk();
    res.json({success:true});
});

app.post(ADMIN_PATH+'/reset-key-usage',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
    if(keyStorage[req.body.keyName]){keyStorage[req.body.keyName].used=0;saveToDisk();res.json({success:true});}
});

app.post(ADMIN_PATH+'/reset-all',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
    Object.keys(keyStorage).forEach(k=>{if(k!==MASTER_API_KEY&&!keyStorage[k]._hardcoded)keyStorage[k].used=0});
    dailyLimits={};perSecondLimits={};saveToDisk();res.json({success:true});
});

app.post(ADMIN_PATH+'/clear-logs',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
    requestLogs=[];keyMonitorLogs=[];saveToDisk();res.json({success:true});
});

app.post(ADMIN_PATH+'/add-api',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
    const{name,endpoint,param,example,realAPI,visible}=req.body;
    if(!name||!endpoint)return res.json({e:'Missing fields'});
    customAPIs.push({id:customAPIs.length+1,name,endpoint,param:param||'num',example:example||'9876543210',visible:visible!==false,realAPI:realAPI||''});
    saveToDisk();res.json({success:true});
});

app.post(ADMIN_PATH+'/toggle-api',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
    const api=customAPIs.find(a=>a.id===parseInt(req.body.id));
    if(api){api.visible=!api.visible;saveToDisk();res.json({success:true,visible:api.visible})}
    else res.json({e:'API not found'});
});

app.post(ADMIN_PATH+'/delete-api',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
    const idx=customAPIs.findIndex(a=>a.id===parseInt(req.body.id));
    if(idx>-1){customAPIs.splice(idx,1);saveToDisk();res.json({success:true})}
    else res.json({e:'API not found'});
});

app.post(ADMIN_PATH+'/update-scopes',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
    const{keyName,scopes}=req.body;
    if(!keyStorage[keyName])return res.json({e:'Key not found'});
    if(keyStorage[keyName]._hardcoded)return res.json({e:'Hardcoded key'});
    keyStorage[keyName].scopes=scopes;
    saveToDisk();res.json({success:true});
});

app.post(ADMIN_PATH+'/add-protection',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
    const{value}=req.body;
    if(!value)return res.json({e:'Missing value'});
    protectedData[value]=value;
    saveToDisk();res.json({success:true,message:'✅ Protected: '+value});
});

app.post(ADMIN_PATH+'/remove-protection',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
    delete protectedData[req.body.value];
    saveToDisk();res.json({success:true});
});

app.post(ADMIN_PATH+'/stop-key',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
    if(!keyStorage[req.body.keyName])return res.json({e:'Key not found'});
    if(keyStorage[req.body.keyName]._hardcoded)return res.json({e:'Hardcoded key'});
    keyStorage[req.body.keyName].stopped=!keyStorage[req.body.keyName].stopped;
    saveToDisk();res.json({success:true,stopped:keyStorage[req.body.keyName].stopped});
});

app.post(ADMIN_PATH+'/disable-key',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
    if(!keyStorage[req.body.keyName])return res.json({e:'Key not found'});
    if(keyStorage[req.body.keyName]._hardcoded)return res.json({e:'Hardcoded key'});
    keyStorage[req.body.keyName].disabled=!keyStorage[req.body.keyName].disabled;
    saveToDisk();res.json({success:true,disabled:keyStorage[req.body.keyName].disabled});
});

app.post(ADMIN_PATH+'/import-keys',async(req,res)=>{
    try{
        if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
        const body = req.body;
        let keysToImport = body.keys || body;
        if (keysToImport.keys && typeof keysToImport.keys === 'object' && !Array.isArray(keysToImport.keys)) {
            keysToImport = keysToImport.keys;
        }
        const metadataFields = ['success', 'total', 'keys', 'exported_at'];
        let imported=0,skipped=0;
        Object.entries(keysToImport).forEach(([keyName,keyData])=>{
            if(metadataFields.includes(keyName) && typeof keyData !== 'object') return;
            if(!keyData || typeof keyData !== 'object') return;
            if(keyStorage[keyName]){skipped++;return;}
            if(keyData._hardcoded) return;
            keyStorage[keyName]={
                name: keyData.name || 'Imported',scopes: keyData.scopes || ['number'],
                type: 'generated',limit: keyData.limit || 100,used: keyData.used || 0,
                cooldown: keyData.cooldown || 0,dailyLimit: keyData.dailyLimit || 0,
                perSecondLimit: keyData.perSecondLimit || 0,
                expiry: keyData.expiry ? new Date(keyData.expiry) : null,
                expiryStr: keyData.expiryStr || 'LIFETIME',
                created: keyData.created || getIndiaDateTime(),
                unlimited: keyData.unlimited || false,hidden: false,_hardcoded: false,
                stopped: keyData.stopped || false,disabled: keyData.disabled || false
            };
            imported++;
        });
        saveToDisk();
        res.json({success:true,imported,skipped,message:`✅ ${imported} keys imported, ${skipped} skipped!`});
    }catch(e){res.json({e:'Error importing keys'})}
});

app.get(ADMIN_PATH+'/export-keys',async(req,res)=>{
    try{
        if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
        const exportKeys={};
        Object.entries(keyStorage).forEach(([k,v])=>{
            if(!v._hardcoded&&!v.hidden){
                exportKeys[k]={
                    name:v.name,scopes:v.scopes,limit:v.limit,used:v.used,
                    cooldown:v.cooldown||0,dailyLimit:v.dailyLimit||0,
                    perSecondLimit:v.perSecondLimit||0,expiry:v.expiry,
                    expiryStr:v.expiryStr,created:v.created,
                    unlimited:v.unlimited||false,stopped:v.stopped||false,
                    disabled:v.disabled||false
                };
            }
        });
        res.json({success:true,total:Object.keys(exportKeys).length,keys:exportKeys,exported_at:getIndiaDateTime()});
    }catch(e){res.json({e:'Error exporting keys'})}
});

app.get(ADMIN_PATH+'/monitor-logs',(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
    res.json({logs: keyMonitorLogs.slice(-200), total: keyMonitorLogs.length});
});

app.get(ADMIN_PATH+'/admin-logs',(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
    res.json({logs: adminLogs.slice(-200), total: adminLogs.length});
});

app.get(ADMIN_PATH+'/stats',(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
    const today = getIndiaDate();
    const weekAgo = new Date(getIndiaTime().getTime() - 7*24*60*60*1000).toISOString().split('T')[0];
    const monthAgo = new Date(getIndiaTime().getTime() - 30*24*60*60*1000).toISOString().split('T')[0];
    const todayLogs = keyMonitorLogs.filter(l=>l.date===today);
    const weekLogs = keyMonitorLogs.filter(l=>l.date>=weekAgo);
    const monthLogs = keyMonitorLogs.filter(l=>l.date>=monthAgo);
    const keyCount = {};
    const endpointCount = {};
    const clientCount = {};
    const ipCount = {};
    const deviceCount = {};
    keyMonitorLogs.forEach(l=>{
        if(!keyCount[l.key]) keyCount[l.key] = 0;
        keyCount[l.key]++;
        if(!endpointCount[l.endpoint]) endpointCount[l.endpoint] = 0;
        endpointCount[l.endpoint]++;
        if(!clientCount[l.clientType]) clientCount[l.clientType] = 0;
        clientCount[l.clientType]++;
        if(!ipCount[l.ip]) ipCount[l.ip] = 0;
        ipCount[l.ip]++;
        if(l.deviceId){if(!deviceCount[l.deviceId]) deviceCount[l.deviceId] = 0; deviceCount[l.deviceId]++;}
    });
    const topKeys = Object.entries(keyCount).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>({key:k,requests:v}));
    const topEndpoints = Object.entries(endpointCount).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([e,v])=>({endpoint:e,requests:v}));
    const clientStats = Object.entries(clientCount).map(([c,v])=>({client:c,requests:v}));
    const topIPs = Object.entries(ipCount).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([ip,v])=>({ip,requests:v}));
    const topDevices = Object.entries(deviceCount).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([d,v])=>({device:d,requests:v}));
    res.json({
        totalRequests: keyMonitorLogs.length,
        todayRequests: todayLogs.length,
        weeklyRequests: weekLogs.length,
        monthlyRequests: monthLogs.length,
        topKeys,
        topEndpoints,
        clientStats,
        topIPs,
        topDevices
    });
});

// ========== IP BAN MANAGEMENT ==========
app.get(ADMIN_PATH+'/banned-ips',(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
    const list = Object.entries(bannedIPs).map(([ip,d])=>({ip,...d}));
    res.json({banned: list, total: list.length});
});

app.post(ADMIN_PATH+'/ban-ip',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
    const{ip, reason, permanent}=req.body;
    if(!ip)return res.json({e:'Missing IP'});
    bannedIPs[ip] = {
        bannedAt: getIndiaDateTime(),
        reason: reason || 'Manual ban by admin',
        banUntil: permanent ? 'PERMANENT' : Date.now() + rateLimitConfig.autoBanDuration
    };
    saveToDisk();
    res.json({success:true,message:'✅ IP banned: '+ip});
});

app.post(ADMIN_PATH+'/unban-ip',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
    delete bannedIPs[req.body.ip];
    if(ipRequestTracker[req.body.ip]) ipRequestTracker[req.body.ip].requests = [];
    if(loginAttempts[req.body.ip]) loginAttempts[req.body.ip] = { attempts: 0, lastAttempt: Date.now(), banned: false, bannedUntil: 0 };
    saveToDisk();
    res.json({success:true,message:'✅ IP unbanned'});
});

app.post(ADMIN_PATH+'/clear-all-banned-ips',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
    bannedIPs = {};
    ipRequestTracker = {};
    loginAttempts = {};
    saveToDisk();
    res.json({success:true,message:'✅ All IPs unbanned'});
});

// ========== DEVICE BAN MANAGEMENT ==========
app.get(ADMIN_PATH+'/banned-devices',(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
    const list = Object.entries(bannedDevices).map(([deviceId,d])=>({deviceId,...d}));
    res.json({banned: list, total: list.length});
});

app.post(ADMIN_PATH+'/ban-device',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
    const{deviceId, reason, permanent}=req.body;
    if(!deviceId)return res.json({e:'Missing device ID'});
    bannedDevices[deviceId] = {
        bannedAt: getIndiaDateTime(),
        reason: reason || 'Manual ban by admin',
        banUntil: permanent ? 'PERMANENT' : Date.now() + rateLimitConfig.autoBanDuration
    };
    saveToDisk();
    res.json({success:true,message:'✅ Device banned: '+deviceId});
});

app.post(ADMIN_PATH+'/unban-device',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
    delete bannedDevices[req.body.deviceId];
    saveToDisk();
    res.json({success:true,message:'✅ Device unbanned'});
});

app.post(ADMIN_PATH+'/clear-all-banned-devices',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
    bannedDevices = {};
    saveToDisk();
    res.json({success:true,message:'✅ All devices unbanned'});
});

app.get(ADMIN_PATH+'/devices',(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
    const list = Object.entries(deviceFingerprints).map(([deviceId,d])=>({
        deviceId,
        ...d,
        isBanned: !!bannedDevices[deviceId]
    })).sort((a,b)=>b.requests - a.requests);
    res.json({devices: list, total: list.length});
});

app.post(ADMIN_PATH+'/rate-limit-config',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
    const{maxRequestsPer10Sec, maxRequestsPerMinute, maxRequestsPerHour, loginAttemptsMax, loginBanDuration, autoBanDuration}=req.body;
    if(maxRequestsPer10Sec) rateLimitConfig.maxRequestsPer10Sec = parseInt(maxRequestsPer10Sec);
    if(maxRequestsPerMinute) rateLimitConfig.maxRequestsPerMinute = parseInt(maxRequestsPerMinute);
    if(maxRequestsPerHour) rateLimitConfig.maxRequestsPerHour = parseInt(maxRequestsPerHour);
    if(loginAttemptsMax) rateLimitConfig.loginAttemptsMax = parseInt(loginAttemptsMax);
    if(loginBanDuration) rateLimitConfig.loginBanDuration = parseInt(loginBanDuration);
    if(autoBanDuration) rateLimitConfig.autoBanDuration = parseInt(autoBanDuration);
    saveToDisk();
    res.json({success:true, config: rateLimitConfig});
});

app.get(ADMIN_PATH+'/rate-limit-config',(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
    res.json(rateLimitConfig);
});

app.get(ADMIN_PATH+'/ip-request-stats',(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
    const now = Date.now();
    const stats = Object.entries(ipRequestTracker).map(([ip,t])=>{
        const reqs10s = t.requests.filter(x=>x>now-10000).length;
        const reqs1m = t.requests.filter(x=>x>now-60000).length;
        const reqs1h = t.requests.filter(x=>x>now-3600000).length;
        return { ip, reqs10s, reqs1m, reqs1h, total: t.requests.length, isBanned: isIPBanned(ip) };
    }).sort((a,b)=>b.reqs1h - a.reqs1h);
    res.json({stats: stats.slice(0,50), total: stats.length});
});

app.post(ADMIN_PATH+'/update-endpoint-response',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
    const{endpoint,responseData}=req.body;
    if(!endpoint)return res.json({e:'Missing endpoint'});
    try {
        endpointResponses[endpoint] = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        saveToDisk();
        res.json({success:true,message:'✅ Response updated!'});
    } catch(e) {
        res.json({e:'Invalid JSON'});
    }
});

app.get(ADMIN_PATH+'/get-endpoint-response',(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
    const{endpoint}=req.query;
    res.json({data: endpointResponses[endpoint] || null});
});

app.post(ADMIN_PATH+'/update-theme',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});
    const{neon}=req.body;
    themeSettings.neon = neon !== false;
    saveToDisk();
    res.json({success:true,neon:themeSettings.neon});
});

app.get('/theme',(req,res)=>{
    res.json(themeSettings);
});

app.use((req,res)=>{res.json({error:'Not found'})});

// ============================================
// 🎨 NEON ULTRA THEME CSS
// ============================================
const NEON_CSS = `
<style>
:root {
  --bg-primary: #0a0505;
  --bg-secondary: #140808;
  --bg-card: rgba(30, 10, 10, 0.85);
  --border-color: rgba(255, 50, 50, 0.15);
  --text-primary: #ffffff;
  --text-secondary: #e0c0c0;
  --text-muted: #a08080;
  
  --neon-red: #ff2d2d;
  --neon-green: #00ff88;
  --neon-orange: #ff9500;
  --neon-white: #ffffff;
  --neon-pink: #ff2d95;
  --neon-purple: #bf00ff;
  --neon-cyan: #00e5ff;
  --neon-yellow: #ffe600;
  
  --gradient-primary: linear-gradient(135deg, #ff2d2d, #ff9500);
  --gradient-rainbow: linear-gradient(90deg, #ff2d2d, #ff9500, #ffe600, #00ff88, #00e5ff, #bf00ff, #ff2d95, #ff2d2d);
  --gradient-neon: linear-gradient(135deg, #ff2d2d 0%, #ff9500 50%, #ffe600 100%);
  
  --glow-red: 0 0 20px rgba(255, 45, 45, 0.7), 0 0 40px rgba(255, 45, 45, 0.3);
  --glow-green: 0 0 20px rgba(0, 255, 136, 0.7), 0 0 40px rgba(0, 255, 136, 0.3);
  --glow-orange: 0 0 20px rgba(255, 149, 0, 0.7), 0 0 40px rgba(255, 149, 0, 0.3);
  --glow-pink: 0 0 20px rgba(255, 45, 149, 0.7), 0 0 40px rgba(255, 45, 149, 0.3);
  --glow-cyan: 0 0 20px rgba(0, 229, 255, 0.7), 0 0 40px rgba(0, 229, 255, 0.3);
  --glow-purple: 0 0 20px rgba(191, 0, 255, 0.7), 0 0 40px rgba(191, 0, 255, 0.3);
  
  --border-radius: 16px;
  --glass-blur: blur(20px);
  --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
*{margin:0;padding:0;box-sizing:border-box}
body{
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: 'Inter', -apple-system, sans-serif;
  min-height: 100vh;
  overflow-x: hidden;
  position: relative;
}
.grid-bg {
  position: fixed;
  inset: 0;
  background-image: 
    linear-gradient(rgba(255, 45, 45, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 45, 45, 0.04) 1px, transparent 1px);
  background-size: 50px 50px;
  z-index: 0;
  pointer-events: none;
}
.grid-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 50%, rgba(255,45,45,0.05), transparent 70%);
}
#snowfall-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}
::-webkit-scrollbar{width:6px}
::-webkit-scrollbar-track{background:var(--bg-primary)}
::-webkit-scrollbar-thumb{background:linear-gradient(#ff2d2d,#ff9500);border-radius:10px;box-shadow:var(--glow-red)}
::-webkit-scrollbar-thumb:hover{background:linear-gradient(#ff9500,#ffe600)}

/* Neon Text Effects */
.neon-text-red { color: var(--neon-red); text-shadow: 0 0 10px var(--neon-red), 0 0 20px var(--neon-red), 0 0 40px var(--neon-red); }
.neon-text-green { color: var(--neon-green); text-shadow: 0 0 10px var(--neon-green), 0 0 20px var(--neon-green), 0 0 40px var(--neon-green); }
.neon-text-orange { color: var(--neon-orange); text-shadow: 0 0 10px var(--neon-orange), 0 0 20px var(--neon-orange), 0 0 40px var(--neon-orange); }
.neon-text-pink { color: var(--neon-pink); text-shadow: 0 0 10px var(--neon-pink), 0 0 20px var(--neon-pink), 0 0 40px var(--neon-pink); }
.neon-text-cyan { color: var(--neon-cyan); text-shadow: 0 0 10px var(--neon-cyan), 0 0 20px var(--neon-cyan), 0 0 40px var(--neon-cyan); }
.neon-text-purple { color: var(--neon-purple); text-shadow: 0 0 10px var(--neon-purple), 0 0 20px var(--neon-purple), 0 0 40px var(--neon-purple); }

/* Admin Layout */
.admin-container { display: flex; min-height: 100vh; position: relative; z-index: 10; }
.sidebar {
  width: 260px;
  background: rgba(20, 8, 8, 0.98);
  border-right: 2px solid rgba(255, 45, 45, 0.2);
  padding: 16px 12px;
  position: fixed;
  height: 100vh;
  overflow-y: auto;
  transition: var(--transition);
  box-shadow: inset -1px 0 0 rgba(255,45,45,0.1), 5px 0 30px rgba(255,45,45,0.05);
}
.sidebar::-webkit-scrollbar{width:4px}
.sidebar::-webkit-scrollbar-thumb{background:var(--neon-red);border-radius:10px}
.main-content { flex: 1; margin-left: 260px; padding: 20px; }
.sidebar-header {
  text-align: center;
  padding: 16px 0;
  border-bottom: 1px solid rgba(255,45,45,0.2);
  margin-bottom: 16px;
}
.sidebar-logo {
  font-size: 36px;
  margin-bottom: 8px;
  animation: neonPulse 2s ease-in-out infinite;
  filter: drop-shadow(0 0 15px rgba(255,45,45,0.8));
}
.sidebar-title {
  font-size: 15px;
  font-weight: 900;
  background: var(--gradient-rainbow);
  background-size: 400% 400%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: 4px;
  animation: rainbowShift 3s linear infinite;
  font-family: 'Orbitron', sans-serif;
}
.sidebar-nav { list-style: none; }
.sidebar-nav li { margin-bottom: 4px; }
.sidebar-nav a {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  color: var(--text-secondary);
  text-decoration: none;
  border-radius: 10px;
  transition: var(--transition);
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  border-left: 3px solid transparent;
}
.sidebar-nav a:hover {
  background: rgba(255, 45, 45, 0.08);
  color: #fff;
  border-left-color: var(--neon-red);
  box-shadow: inset 0 0 20px rgba(255,45,45,0.1);
  transform: translateX(3px);
}
.sidebar-nav a.active {
  background: linear-gradient(90deg, rgba(255,45,45,0.2), rgba(255,149,0,0.05));
  color: #fff;
  border-left-color: var(--neon-red);
  box-shadow: inset 0 0 30px rgba(255,45,45,0.15), var(--glow-red);
}
.sidebar-nav i { width: 18px; text-align: center; font-size: 13px; }

/* Neon Cards */
.glow-card {
  background: var(--bg-card);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  padding: 22px;
  margin-bottom: 20px;
  transition: var(--transition);
  position: relative;
  overflow: hidden;
}
.glow-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--gradient-rainbow);
  background-size: 500% 500%;
  animation: rainbowShift 4s linear infinite;
  opacity: 0.8;
}
.glow-card:hover {
  box-shadow: 0 0 30px rgba(255,45,45,0.2);
  border-color: rgba(255, 45, 45, 0.3);
  transform: translateY(-2px);
}
.glow-card h3 {
  margin-bottom: 18px;
  font-size: 16px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #fff;
  font-family: 'Orbitron', sans-serif;
  letter-spacing: 1px;
}
.glow-card h3 i { color: var(--neon-red); filter: drop-shadow(0 0 8px var(--neon-red)); }

/* Stat Cards */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}
.stat-card {
  background: rgba(20, 8, 8, 0.9);
  border: 1px solid rgba(255,45,45,0.15);
  border-radius: 14px;
  padding: 18px 14px;
  text-align: center;
  transition: var(--transition);
  position: relative;
  overflow: hidden;
}
.stat-card:nth-child(1){--glow: var(--glow-red); --neon: var(--neon-red);}
.stat-card:nth-child(2){--glow: var(--glow-green); --neon: var(--neon-green);}
.stat-card:nth-child(3){--glow: var(--glow-orange); --neon: var(--neon-orange);}
.stat-card:nth-child(4){--glow: var(--glow-cyan); --neon: var(--neon-cyan);}
.stat-card:nth-child(5){--glow: var(--glow-pink); --neon: var(--neon-pink);}
.stat-card:nth-child(6){--glow: var(--glow-purple); --neon: var(--neon-purple);}
.stat-card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 14px;
  opacity: 0;
  transition: var(--transition);
  box-shadow: var(--glow);
}
.stat-card:hover { transform: translateY(-5px) scale(1.02); border-color: var(--neon); }
.stat-card:hover::after { opacity: 1; }
.stat-icon { font-size: 28px; margin-bottom: 8px; filter: drop-shadow(0 0 10px currentColor); }
.stat-value {
  font-size: 26px;
  font-weight: 900;
  font-family: 'Orbitron', sans-serif;
  color: var(--neon, #fff);
  text-shadow: 0 0 15px var(--neon, #fff);
  margin-bottom: 4px;
}
.stat-label {
  font-size: 9px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 2px;
  font-weight: 600;
}

/* Forms */
.form-group { margin-bottom: 14px; }
.form-group label {
  display: block;
  margin-bottom: 6px;
  color: var(--neon-orange);
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  text-shadow: 0 0 8px rgba(255,149,0,0.4);
}
.form-input {
  width: 100%;
  padding: 10px 14px;
  background: rgba(10, 5, 5, 0.9);
  border: 1.5px solid rgba(255,45,45,0.25);
  border-radius: 10px;
  color: #fff;
  font-size: 13px;
  transition: var(--transition);
  outline: none;
  font-family: 'Inter', sans-serif;
}
.form-input:focus {
  border-color: var(--neon-red);
  box-shadow: 0 0 20px rgba(255,45,45,0.4), inset 0 0 10px rgba(255,45,45,0.05);
}
.form-input option { background: #140808; color: #fff; }

/* Neon Buttons */
.btn-primary {
  padding: 11px 22px;
  background: var(--gradient-primary);
  color: #fff;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 1px;
  transition: var(--transition);
  box-shadow: 0 4px 20px rgba(255,45,45,0.4);
  font-family: 'Orbitron', sans-serif;
  position: relative;
  overflow: hidden;
}
.btn-primary:hover {
  box-shadow: 0 0 30px rgba(255,45,45,0.7), 0 0 60px rgba(255,149,0,0.4);
  transform: translateY(-2px);
}
.btn-success {
  background: linear-gradient(135deg, #00ff88, #00b85c);
  box-shadow: 0 4px 20px rgba(0,255,136,0.4);
}
.btn-success:hover {
  box-shadow: 0 0 30px rgba(0,255,136,0.7), 0 0 60px rgba(0,255,136,0.4);
}
.btn-danger {
  background: linear-gradient(135deg, #ff2d2d, #cc0000);
  box-shadow: 0 4px 20px rgba(255,45,45,0.5);
}
.btn-danger:hover {
  box-shadow: 0 0 30px rgba(255,45,45,0.9), 0 0 60px rgba(255,45,45,0.5);
}
.btn-warning {
  background: linear-gradient(135deg, #ff9500, #cc7000);
  box-shadow: 0 4px 20px rgba(255,149,0,0.4);
}
.btn-warning:hover {
  box-shadow: 0 0 30px rgba(255,149,0,0.7);
}
.btn-action {
  padding: 5px 9px;
  border-radius: 6px;
  border: 1px solid;
  cursor: pointer;
  font-size: 10px;
  transition: var(--transition);
  background: transparent;
  margin: 2px;
  font-family: 'Inter', sans-serif;
  font-weight: 600;
}
.btn-reset { color: var(--neon-green); border-color: rgba(0,255,136,0.4); }
.btn-reset:hover { background: rgba(0,255,136,0.15); box-shadow: var(--glow-green); }
.btn-push { color: var(--neon-orange); border-color: rgba(255,149,0,0.4); }
.btn-push:hover { background: rgba(255,149,0,0.15); box-shadow: var(--glow-orange); }
.btn-stop { color: var(--neon-red); border-color: rgba(255,45,45,0.4); }
.btn-stop:hover { background: rgba(255,45,45,0.15); box-shadow: var(--glow-red); }
.btn-delete { color: var(--neon-pink); border-color: rgba(255,45,149,0.4); }
.btn-delete:hover { background: rgba(255,45,149,0.15); box-shadow: var(--glow-pink); }
.btn-edit { color: var(--neon-cyan); border-color: rgba(0,229,255,0.4); }
.btn-edit:hover { background: rgba(0,229,255,0.15); box-shadow: var(--glow-cyan); }
.btn-disable { color: var(--neon-yellow); border-color: rgba(255,230,0,0.4); }
.btn-disable:hover { background: rgba(255,230,0,0.15); box-shadow: 0 0 20px rgba(255,230,0,0.5); }

/* Tables */
.table-container { overflow-x: auto; border-radius: 10px; border: 1px solid rgba(255,45,45,0.1); }
table { width: 100%; border-collapse: collapse; font-size: 11px; }
th {
  background: rgba(255,45,45,0.08);
  color: var(--neon-orange);
  padding: 10px 8px;
  text-align: left;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 9px;
  letter-spacing: 1px;
  position: sticky;
  top: 0;
  z-index: 2;
  border-bottom: 1px solid rgba(255,45,45,0.2);
  text-shadow: 0 0 8px rgba(255,149,0,0.3);
}
td { padding: 8px; border-bottom: 1px solid rgba(255,45,45,0.08); color: var(--text-secondary); }
tr:hover td { background: rgba(255,45,45,0.05); }
code {
  background: rgba(255,45,45,0.1);
  padding: 3px 7px;
  border-radius: 5px;
  color: var(--neon-orange);
  font-family: 'Space Grotesk', monospace;
  font-size: 10px;
  border: 1px solid rgba(255,149,0,0.15);
  text-shadow: 0 0 8px rgba(255,149,0,0.3);
}

/* Endpoint Cards */
.endpoint-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
.endpoint-card {
  background: rgba(20, 8, 8, 0.8);
  border: 1px solid rgba(255,45,45,0.15);
  border-radius: 14px;
  padding: 16px;
  cursor: pointer;
  transition: var(--transition);
  position: relative;
  overflow: hidden;
}
.endpoint-card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 14px;
  opacity: 0;
  transition: var(--transition);
  box-shadow: inset 0 0 30px rgba(255,45,45,0.1), 0 0 25px rgba(255,45,45,0.3);
}
.endpoint-card:hover {
  transform: translateY(-4px);
  border-color: var(--neon-red);
  box-shadow: 0 0 30px rgba(255,45,45,0.3);
}
.endpoint-card:hover::after { opacity: 1; }
.endpoint-card .ep-icon { font-size: 24px; margin-bottom: 8px; filter: drop-shadow(0 0 10px rgba(255,149,0,0.6)); }
.endpoint-card .ep-name { font-size: 14px; font-weight: 700; margin-bottom: 6px; color: var(--neon-red); text-shadow: 0 0 12px rgba(255,45,45,0.6); }
.endpoint-card .ep-desc { font-size: 10px; color: var(--text-muted); margin-bottom: 10px; }
.endpoint-card .ep-url {
  font-size: 9px;
  color: var(--neon-green);
  background: rgba(0,255,136,0.05);
  padding: 6px 8px;
  border-radius: 6px;
  font-family: 'Space Grotesk', monospace;
  word-break: break-all;
  border: 1px solid rgba(0,255,136,0.1);
  text-shadow: 0 0 8px rgba(0,255,136,0.3);
}

/* Live Monitor */
.live-logs {
  background: rgba(5, 2, 2, 0.95);
  border: 1px solid rgba(255,45,45,0.2);
  border-radius: 14px;
  padding: 12px;
  max-height: 450px;
  overflow-y: auto;
  font-family: 'Space Grotesk', monospace;
  font-size: 10px;
}
.live-logs::-webkit-scrollbar{width:4px}
.live-logs::-webkit-scrollbar-thumb{background:var(--neon-red);border-radius:10px}
.log-entry {
  padding: 7px 8px;
  border-bottom: 1px solid rgba(255,45,45,0.08);
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  transition: var(--transition);
  align-items: center;
  border-radius: 6px;
}
.log-entry:hover { background: rgba(255,45,45,0.08); box-shadow: 0 0 15px rgba(255,45,45,0.1); }
.log-time { color: var(--text-muted); font-size: 9px; }
.log-key { color: var(--neon-red); font-weight: 700; text-shadow: 0 0 6px rgba(255,45,45,0.5); }
.log-endpoint { color: var(--neon-orange); text-shadow: 0 0 6px rgba(255,149,0,0.5); }
.log-ip { color: var(--neon-cyan); text-shadow: 0 0 6px rgba(0,229,255,0.5); }
.log-device { color: var(--neon-pink); text-shadow: 0 0 6px rgba(255,45,149,0.5); }
.log-client { color: var(--neon-green); text-shadow: 0 0 6px rgba(0,255,136,0.5); }
.log-browser { color: var(--neon-purple); text-shadow: 0 0 6px rgba(191,0,255,0.5); }

/* Toast */
.toast {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 99999;
  padding: 14px 22px;
  border-radius: 12px;
  color: #fff;
  font-weight: 600;
  font-size: 12px;
  animation: slideIn 0.4s ease;
  max-width: 400px;
  backdrop-filter: blur(20px);
  font-family: 'Inter', sans-serif;
  border: 1px solid;
}
.toast.success { background: rgba(0,255,136,0.15); border-color: var(--neon-green); box-shadow: var(--glow-green); color: var(--neon-green); }
.toast.error { background: rgba(255,45,45,0.15); border-color: var(--neon-red); box-shadow: var(--glow-red); color: var(--neon-red); }
.toast.warning { background: rgba(255,149,0,0.15); border-color: var(--neon-orange); box-shadow: var(--glow-orange); color: var(--neon-orange); }

@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
@keyframes neonPulse {
  0%, 100% { filter: drop-shadow(0 0 15px rgba(255,45,45,0.8)); }
  50% { filter: drop-shadow(0 0 35px rgba(255,149,0,0.9)); }
}
@keyframes rainbowShift {
  0% { background-position: 0% 50%; }
  100% { background-position: 500% 50%; }
}
@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}
@keyframes dotFloat {
  0%, 100% { transform: translateY(0); opacity: 0.5; }
  50% { transform: translateY(-10px); opacity: 1; }
}

/* Responsive */
@media(max-width: 768px) {
  .sidebar { width: 55px; padding: 8px 4px; }
  .sidebar .sidebar-title, .sidebar-nav a span { display: none; }
  .sidebar-nav a { justify-content: center; padding: 10px 6px; }
  .main-content { margin-left: 55px; padding: 10px; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .endpoint-grid { grid-template-columns: 1fr; }
}
</style>`;

// ============================================
// NEON LOGIN PAGE
// ============================================
function renderLogin(){
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>BRONX V300 | Secure Login</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Orbitron:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
${NEON_CSS}
<style>
body{display:flex;align-items:center;justify-content:center;overflow:hidden;background:#0a0505}
.login-container{position:relative;z-index:10;width:420px;max-width:90vw}
.login-card{
  background:rgba(20, 8, 8, 0.95);
  backdrop-filter:blur(20px);
  border:1px solid rgba(255,45,45,0.3);
  border-radius:24px;
  padding:45px 35px;
  position:relative;
  box-shadow:0 0 60px rgba(255,45,45,0.25), 0 0 120px rgba(255,149,0,0.1), 0 8px 32px rgba(0,0,0,0.6);
  overflow:hidden;
}
.login-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--gradient-rainbow);background-size:400% 400%;animation:rainbowShift 3s linear infinite}
.login-card::after{content:'';position:absolute;inset:0;border-radius:24px;box-shadow:inset 0 0 60px rgba(255,45,45,0.1);pointer-events:none}
.login-logo{text-align:center;margin-bottom:18px}
.login-logo .icon{font-size:60px;display:inline-block;animation:neonPulse 2s ease-in-out infinite}
.login-logo .brand{font-family:'Orbitron',sans-serif;font-size:15px;font-weight:900;letter-spacing:8px;background:var(--gradient-rainbow);background-size:400% 400%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:rainbowShift 3s linear infinite;margin-top:6px}
.login-title{text-align:center;font-family:'Orbitron',sans-serif;font-size:30px;font-weight:900;color:#fff;margin-bottom:6px;letter-spacing:3px;text-shadow:0 0 20px rgba(255,45,45,0.8), 0 0 40px rgba(255,149,0,0.4)}
.login-subtitle{text-align:center;color:#a08080;font-size:10px;letter-spacing:5px;text-transform:uppercase;margin-bottom:30px}
.input-group{position:relative;margin-bottom:18px}
.input-group .input-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--neon-red);font-size:15px;transition:.3s;z-index:2;text-shadow:0 0 10px var(--neon-red)}
.input-group input{width:100%;padding:15px 15px 15px 44px;background:rgba(10,5,5,0.9);border:1.5px solid rgba(255,45,45,0.3);border-radius:14px;color:#fff;font-family:'Inter',sans-serif;font-size:13px;outline:none;transition:.4s}
.input-group input:focus{border-color:var(--neon-red);box-shadow:0 0 25px rgba(255,45,45,0.5), inset 0 0 15px rgba(255,45,45,0.05)}
.input-group input:focus~.input-icon{color:var(--neon-orange);text-shadow:0 0 15px var(--neon-orange)}
.login-btn{width:100%;padding:16px;background:var(--gradient-rainbow);background-size:500% 500%;color:#000;border:none;border-radius:14px;cursor:pointer;font-size:14px;font-weight:900;letter-spacing:4px;font-family:'Orbitron',sans-serif;animation:rainbowShift 4s ease infinite;transition:.3s;position:relative;overflow:hidden;box-shadow:0 0 30px rgba(255,45,45,0.5), 0 0 60px rgba(255,149,0,0.2)}
.login-btn:hover{transform:translateY(-3px);box-shadow:0 0 50px rgba(255,45,45,0.8), 0 0 100px rgba(255,149,0,0.4)}
.message{text-align:center;margin-top:14px;font-size:11px;font-weight:600;min-height:20px}
.login-footer{text-align:center;margin-top:20px;font-size:9px;color:#a08080;letter-spacing:2px}
.login-footer span{background:var(--gradient-primary);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:700;text-shadow:none}
.glow-dots{position:absolute;width:8px;height:8px;background:var(--neon-red);border-radius:50%;box-shadow:var(--glow-red);animation:dotFloat 4s ease-in-out infinite}
.dot-1{top:20px;right:30px;animation-delay:0s;background:var(--neon-red)}
.dot-2{bottom:30px;left:25px;animation-delay:1.5s;background:var(--neon-green)}
.dot-3{top:50%;right:15px;animation-delay:3s;background:var(--neon-orange)}
.dot-4{top:15px;left:20px;animation-delay:0.8s;background:var(--neon-cyan)}
.dot-5{bottom:15px;right:25px;animation-delay:2.2s;background:var(--neon-pink)}
</style></head><body>
<div class="grid-bg"></div>
<canvas id="snowfall-canvas"></canvas>
<div class="login-container"><div class="login-card">
<div class="glow-dots dot-1"></div><div class="glow-dots dot-2"></div><div class="glow-dots dot-3"></div>
<div class="glow-dots dot-4"></div><div class="glow-dots dot-5"></div>
<div class="login-logo"><span class="icon">🛡️</span><div class="brand">BRONX OSINT</div></div>
<h2 class="login-title">V300 NEON</h2>
<p class="login-subtitle">Secure Dashboard Access</p>
<div class="input-group"><i class="fas fa-user input-icon"></i><input type="text" id="username" placeholder="Username" autocomplete="off"></div>
<div class="input-group"><i class="fas fa-lock input-icon"></i><input type="password" id="password" placeholder="Password" autocomplete="off"></div>
<button class="login-btn" onclick="login()"><i class="fas fa-shield-halved"></i> AUTHENTICATE</button>
<div class="message" id="message"></div>
<div class="login-footer">Powered by <span>@BRONX_ULTRA</span></div>
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
document.addEventListener('keydown',(e)=>{if(e.key==='Enter')login()});
</script></body></html>`;
}

// ============================================
// NEON ADMIN PANEL
// ============================================
function renderAdmin(token){
    try{
        const allKeys=Object.entries(keyStorage).filter(([k,d])=>!d._hardcoded&&!d.hidden).map(([k,d])=>({
            key:k, name:d.name||'?', limit:d.unlimited?'∞':d.limit, used:d.used||0,
            left:d.unlimited?'∞':Math.max(0,(d.limit||0)-(d.used||0)),
            dailyLimit:d.dailyLimit||0, perSecondLimit:d.perSecondLimit||0,
            expiry:d.expiryStr||'Lifetime', isExpired:d.expiry?isKeyExpired(d.expiry):false,
            scopes:d.scopes||[], cooldown:d.cooldown||0, created:d.created||'',
            stopped:d.stopped||false, disabled:d.disabled||false
        }));
        const hcCount=Object.values(keyStorage).filter(k=>k._hardcoded).length;
        const todayReqs=requestLogs.filter(l=>l.timestamp&&l.timestamp.startsWith(getIndiaDate())).length;
        const stoken=esc(token);
        
        let keysHTML=allKeys.map(k=>{
            let s='🟢 ACTIVE';
            if(k.isExpired){s='🔴 EXPIRED'} else if(k.left==0){s='🟠 LIMIT'} else if(k.stopped){s='⛔ STOPPED'} else if(k.disabled){s='🚫 DISABLED'}
            const sd=k.scopes.includes('*')?'🌟 ALL':k.scopes.slice(0,2).join(',')+(k.scopes.length>2?'..':'');
            return `<tr>
                <td><code>${esc(k.key.substring(0,14))}${k.key.length>14?'..':''}</code></td>
                <td style="color:var(--neon-orange)">${esc(k.name)}</td><td>${k.limit}</td><td>${k.used}</td>
                <td>${k.dailyLimit||'∞'}</td><td>${k.perSecondLimit||'∞'}/s</td>
                <td style="color:${k.left==0?'#ff2d2d':'#00ff88'}">${k.left}</td>
                <td>${esc(k.expiry)}</td><td style="color:var(--neon-cyan)">${sd}</td><td>${s}</td>
                <td style="font-size:9px">${esc(k.created||'')}</td>
                <td style="text-align:center;white-space:nowrap">
                    <button class="btn-action btn-reset" onclick="resetKey('${esc(k.key)}')" title="Reset Usage"><i class="fas fa-sync-alt"></i></button>
                    <button class="btn-action btn-push" onclick="pushKey('${esc(k.key)}')" title="Push Expiry"><i class="fas fa-arrow-up"></i></button>
                    <button class="btn-action btn-edit" onclick="editKey('${esc(k.key)}')" title="Edit Key"><i class="fas fa-edit"></i></button>
                    <button class="btn-action btn-disable" onclick="disableKey('${esc(k.key)}')" title="${k.disabled?'Enable':'Disable'}"><i class="fas fa-${k.disabled?'check':'ban'}"></i></button>
                    <button class="btn-action btn-stop" onclick="stopKey('${esc(k.key)}')" title="${k.stopped?'Activate':'Stop'}"><i class="fas fa-${k.stopped?'play':'pause'}"></i></button>
                    <button class="btn-action btn-delete" onclick="deleteKey('${esc(k.key)}')" title="Delete"><i class="fas fa-trash"></i></button>
                </td></tr>`;
        }).join('');
        
        const apiHTML=customAPIs.map(a=>`<tr>
            <td>${a.id}</td><td style="color:var(--neon-orange)">${esc(a.name)}</td><td><code>/${esc(a.endpoint)}</code></td>
            <td>${esc(a.param)}</td><td style="color:${a.visible?'#00ff88':'#ff2d2d'}">${a.visible?'👁 Visible':'🙈 Hidden'}</td>
            <td>
                <button class="btn-action btn-push" onclick="toggleAPI(${a.id})">${a.visible?'<i class="fas fa-eye-slash"></i> Hide':'<i class="fas fa-eye"></i> Show'}</button>
                <button class="btn-action btn-delete" onclick="deleteAPI(${a.id})"><i class="fas fa-trash"></i></button>
            </td></tr>`).join('');
        
        const protHTML=Object.keys(protectedData).map(v=>`<tr>
            <td><code style="color:var(--neon-red)">${esc(v)}</code></td><td>🔒 Protected</td>
            <td><button class="btn-action btn-delete" onclick="removeProt('${esc(v)}')"><i class="fas fa-unlock"></i></button></td>
        </tr>`).join('')||'<tr><td colspan="3" style="color:var(--text-muted)">No protected data</td></tr>';
        
        // Group endpoints by category
        const categories = {};
        Object.entries(endpoints).forEach(([n,e])=>{
            const cat = e.c || 'other';
            if(!categories[cat]) categories[cat] = [];
            categories[cat].push({name:n, ...e});
        });
        
        const epHTML = Object.entries(categories).map(([cat, eps])=>`
            <div style="margin-bottom:20px">
                <h4 style="color:var(--neon-orange);margin-bottom:10px;text-transform:uppercase;letter-spacing:2px;font-size:12px;text-shadow:0 0 10px rgba(255,149,0,0.5)">📂 ${cat.toUpperCase()}</h4>
                <div class="endpoint-grid">
                    ${eps.map(e=>`<div class="endpoint-card" onclick="copyEndpoint('${e.name}','${e.p}','${e.e}')">
                        <div class="ep-icon">${e.i}</div>
                        <div class="ep-name">/${e.name}</div>
                        <div class="ep-desc">${e.d}</div>
                        <div class="ep-url">GET /api/key-bronx/${e.name}?key=KEY&${e.p}=${e.e}</div>
                    </div>`).join('')}
                </div>
            </div>
        `).join('');

        const bannedIPsHTML = Object.entries(bannedIPs).map(([ip,d])=>`<tr>
            <td><code style="color:var(--neon-red)">${esc(ip)}</code></td>
            <td style="color:var(--neon-orange);font-size:10px">${esc(d.reason)}</td>
            <td style="font-size:9px">${esc(d.bannedAt)}</td>
            <td style="color:${d.banUntil==='PERMANENT'?'#ff2d2d':'#ff9500'}">${d.banUntil==='PERMANENT'?'PERMANENT':new Date(d.banUntil).toLocaleString()}</td>
            <td><button class="btn-action btn-reset" onclick="unbanIP('${esc(ip)}')"><i class="fas fa-unlock"></i> Unban</button></td>
        </tr>`).join('')||'<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No banned IPs</td></tr>';

        const bannedDevicesHTML = Object.entries(bannedDevices).map(([deviceId,d])=>`<tr>
            <td><code style="color:var(--neon-pink);font-size:9px">${esc(deviceId.substring(0,25))}..</code></td>
            <td style="color:var(--neon-orange);font-size:10px">${esc(d.reason)}</td>
            <td style="font-size:9px">${esc(d.bannedAt)}</td>
            <td><button class="btn-action btn-reset" onclick="unbanDevice('${esc(deviceId)}')"><i class="fas fa-unlock"></i> Unban</button></td>
        </tr>`).join('')||'<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No banned devices</td></tr>';

        const devicesHTML = Object.entries(deviceFingerprints).sort((a,b)=>b[1].requests-a[1].requests).slice(0,50).map(([deviceId,d])=>`<tr>
            <td><code style="color:var(--neon-cyan);font-size:9px">${esc(deviceId.substring(0,20))}..</code></td>
            <td>${d.deviceIcon||'❓'} ${esc(d.deviceType||'Unknown')}</td>
            <td>${esc(d.os||'?')}</td>
            <td style="color:var(--neon-green)">${esc(d.browser||'?')}</td>
            <td>${d.requests||0}</td>
            <td style="font-size:9px">${esc(d.firstSeen||'')}</td>
            <td style="font-size:9px">${esc(d.lastSeen||'')}</td>
            <td>${bannedDevices[deviceId]?'<span style="color:#ff2d2d">🚫 BANNED</span>':'<span style="color:#00ff88">🟢 OK</span>'}</td>
            <td><button class="btn-action btn-stop" onclick="banDevice('${esc(deviceId)}')"><i class="fas fa-ban"></i> Ban</button></td>
        </tr>`).join('')||'<tr><td colspan="9" style="text-align:center;color:var(--text-muted)">No devices</td></tr>';

        return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>BRONX V300 | NEON ADMIN</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Orbitron:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
${NEON_CSS}
</head><body>
<div class="grid-bg"></div>
<canvas id="snowfall-canvas"></canvas>
<div class="admin-container">
  <!-- SIDEBAR -->
  <div class="sidebar">
    <div class="sidebar-header">
      <div class="sidebar-logo">🛡️</div>
      <div class="sidebar-title">BRONX V300</div>
    </div>
    <ul class="sidebar-nav">
      <li><a class="active" onclick="switchSection('dashboard',this)"><i class="fas fa-chart-pie"></i><span>Dashboard</span></a></li>
      <li><a onclick="switchSection('generate',this)"><i class="fas fa-plus-circle"></i><span>Generate Key</span></a></li>
      <li><a onclick="switchSection('keys',this)"><i class="fas fa-key"></i><span>All Keys</span></a></li>
      <li><a onclick="switchSection('endpoints',this)"><i class="fas fa-list"></i><span>Endpoints</span></a></li>
      <li><a onclick="switchSection('responses',this)"><i class="fas fa-code"></i><span>Edit Responses</span></a></li>
      <li><a onclick="switchSection('monitor',this)"><i class="fas fa-desktop"></i><span>Live Monitor</span></a></li>
      <li><a onclick="switchSection('ipstats',this)"><i class="fas fa-network-wired"></i><span>IP Requests</span></a></li>
      <li><a onclick="switchSection('stats',this)"><i class="fas fa-chart-bar"></i><span>Statistics</span></a></li>
      <li><a onclick="switchSection('import',this)"><i class="fas fa-download"></i><span>Import</span></a></li>
      <li><a onclick="switchSection('export',this)"><i class="fas fa-upload"></i><span>Export</span></a></li>
      <li><a onclick="switchSection('scopes',this)"><i class="fas fa-crosshairs"></i><span>Scopes</span></a></li>
      <li><a onclick="switchSection('push',this)"><i class="fas fa-arrow-up"></i><span>Push Keys</span></a></li>
      <li><a onclick="switchSection('protect',this)"><i class="fas fa-shield-alt"></i><span>Protection</span></a></li>
      <li><a onclick="switchSection('apis',this)"><i class="fas fa-plug"></i><span>Custom APIs</span></a></li>
      <li><a onclick="switchSection('addapi',this)"><i class="fas fa-puzzle-piece"></i><span>Add API</span></a></li>
      <li><a onclick="switchSection('bannedips',this)"><i class="fas fa-ban"></i><span>Banned IPs</span></a></li>
      <li><a onclick="switchSection('banneddevices',this)"><i class="fas fa-mobile-alt"></i><span>Banned Devices</span></a></li>
      <li><a onclick="switchSection('devices',this)"><i class="fas fa-laptop"></i><span>Devices</span></a></li>
      <li><a onclick="switchSection('ratelimit',this)"><i class="fas fa-tachometer-alt"></i><span>Rate Limit / DDoS</span></a></li>
      <li><a onclick="switchSection('adminlogs',this)"><i class="fas fa-history"></i><span>Admin Logs</span></a></li>
      <li><a onclick="switchSection('settings',this)"><i class="fas fa-cog"></i><span>Settings</span></a></li>
    </ul>
  </div>

  <!-- MAIN CONTENT -->
  <div class="main-content">
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">🔑</div>
        <div class="stat-value">${allKeys.length}</div>
        <div class="stat-label">Generated Keys</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">💎</div>
        <div class="stat-value">${hcCount}</div>
        <div class="stat-label">Hardcoded</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📊</div>
        <div class="stat-value" id="statToday">${todayReqs}</div>
        <div class="stat-label">Today</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📈</div>
        <div class="stat-value" id="statTotal">${requestLogs.length}</div>
        <div class="stat-label">Total Requests</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🚫</div>
        <div class="stat-value" id="statBannedIPs">${Object.keys(bannedIPs).length}</div>
        <div class="stat-label">Banned IPs</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📱</div>
        <div class="stat-value" id="statBannedDevices">${Object.keys(bannedDevices).length}</div>
        <div class="stat-label">Banned Devices</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🔒</div>
        <div class="stat-value">${Object.keys(protectedData).length}</div>
        <div class="stat-label">Protected</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🔌</div>
        <div class="stat-value">${customAPIs.length}</div>
        <div class="stat-label">Custom APIs</div>
      </div>
    </div>

    <!-- Dashboard -->
    <div class="glow-card" id="section-dashboard">
      <h3><i class="fas fa-fire"></i> Request Overview</h3>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-value" id="dashToday">-</div><div class="stat-label">Today</div></div>
        <div class="stat-card"><div class="stat-value" id="dashWeek">-</div><div class="stat-label">This Week</div></div>
        <div class="stat-card"><div class="stat-value" id="dashMonth">-</div><div class="stat-label">This Month</div></div>
        <div class="stat-card"><div class="stat-value" id="dashTotal">-</div><div class="stat-label">All Time</div></div>
      </div>
      <h3><i class="fas fa-trophy"></i> Top Keys</h3>
      <div class="table-container">
        <table>
          <thead><tr><th>Key</th><th>Requests</th><th>Status</th></tr></thead>
          <tbody id="topKeysBody"><tr><td colspan="3" style="text-align:center;color:var(--text-muted)">Loading...</td></tr></tbody>
        </table>
      </div>
      <h3 style="margin-top:20px"><i class="fas fa-globe"></i> Top IPs</h3>
      <div class="table-container">
        <table>
          <thead><tr><th>IP</th><th>Requests</th><th>Status</th></tr></thead>
          <tbody id="topIPsBody"><tr><td colspan="3" style="text-align:center;color:var(--text-muted)">Loading...</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- Generate Key -->
    <div class="glow-card" id="section-generate" style="display:none">
      <h3><i class="fas fa-wand-magic-sparkles"></i> Generate New API Key</h3>
      <div class="form-group"><label>Key ID (leave empty for random)</label><input class="form-input" id="gk" placeholder="MY_KEY_NAME or leave empty"></div>
      <button class="btn-primary btn-warning" onclick="randomKey()" style="margin-bottom:12px;width:100%"><i class="fas fa-dice"></i> 🎲 GENERATE RANDOM KEY NAME</button>
      <div class="form-group"><label>Owner Name</label><input class="form-input" id="go" placeholder="Client Name"></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
        <div class="form-group"><label>Total Limit</label><input class="form-input" id="gl" type="number" value="100"></div>
        <div class="form-group"><label>Daily Limit (0=∞)</label><input class="form-input" id="gdl" type="number" value="0"></div>
        <div class="form-group"><label>Per Second (0=∞)</label><input class="form-input" id="gpsl" type="number" value="0"></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
        <div class="form-group"><label>Cooldown (sec)</label><input class="form-input" id="gc" type="number" value="0"></div>
        <div class="form-group"><label>Days Valid</label><input class="form-input" id="gd" type="number" value="30"></div>
      </div>
      <div class="form-group">
        <label>Select Scopes (Custom APIs shown individually)</label>
        <div style="display:flex;flex-wrap:wrap;gap:8px;padding:12px;background:rgba(255,45,45,0.05);border-radius:10px;border:1px solid rgba(255,45,45,0.1);max-height:300px;overflow-y:auto">
          <label style="cursor:pointer;font-size:11px;color:var(--neon-red)"><input type="checkbox" value="*" id="scope-all" checked> 🌟 ALL ACCESS</label>
          <div style="width:100%;height:1px;background:rgba(255,45,45,0.15);margin:4px 0"></div>
          ${Object.keys(endpoints).map(e=>`<label style="cursor:pointer;font-size:10px"><input type="checkbox" value="${e}" class="scope-cb"> ${endpoints[e].i} ${e}</label>`).join('')}
          <div style="width:100%;height:1px;background:rgba(255,45,45,0.15);margin:4px 0"></div>
          <label style="cursor:pointer;font-size:11px;color:var(--neon-green)"><input type="checkbox" value="custom" class="scope-cb"> 🔧 ALL Custom APIs</label>
          ${customAPIs.map(a=>`<label style="cursor:pointer;font-size:10px;color:var(--neon-cyan)"><input type="checkbox" value="custom:${a.endpoint}" class="scope-cb"> 🔧 ${a.name} (${a.endpoint})</label>`).join('')}
        </div>
      </div>
      <button class="btn-primary" onclick="generateKey()" style="width:100%"><i class="fas fa-rocket"></i> GENERATE KEY</button>
    </div>

    <!-- Keys -->
    <div class="glow-card" id="section-keys" style="display:none">
      <h3><i class="fas fa-key"></i> All Keys (${allKeys.length})</h3>
      <div class="table-container" style="max-height:600px">
        <table>
          <thead><tr><th>KEY</th><th>OWNER</th><th>LIMIT</th><th>USED</th><th>DAY</th><th>/SEC</th><th>LEFT</th><th>EXPIRY</th><th>SCOPES</th><th>STATUS</th><th>CREATED</th><th>ACTIONS</th></tr></thead>
          <tbody>${keysHTML}</tbody>
        </table>
      </div>
    </div>

    <!-- Endpoints -->
    <div class="glow-card" id="section-endpoints" style="display:none">
      <h3><i class="fas fa-list"></i> API Endpoints (${Object.keys(endpoints).length})</h3>
      ${epHTML}
    </div>

    <!-- Edit Responses -->
    <div class="glow-card" id="section-responses" style="display:none">
      <h3><i class="fas fa-code"></i> Edit Endpoint Responses</h3>
      <div class="form-group">
        <label>Select Endpoint</label>
        <select class="form-input" id="responseEndpoint" onchange="loadResponse()">
          ${Object.keys(endpoints).map(e=>`<option value="${e}">${endpoints[e].d} (/${e})</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Response JSON (leave empty to restore default)</label>
        <textarea class="form-input" id="responseData" rows="10" placeholder='{"example": "response"}' style="font-family:'Space Grotesk',monospace;font-size:11px"></textarea>
      </div>
      <button class="btn-primary" onclick="updateResponse()" style="width:100%"><i class="fas fa-save"></i> SAVE RESPONSE</button>
    </div>

    <!-- Live Monitor -->
    <div class="glow-card" id="section-monitor" style="display:none">
      <h3><i class="fas fa-desktop"></i> Live Key Monitor <span style="font-size:10px;color:var(--neon-green);text-shadow:0 0 10px var(--neon-green)">● LIVE</span></h3>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <input class="form-input" id="monitorFilter" placeholder="🔍 Filter by IP, Key, Endpoint, Device..." style="flex:1;min-width:200px" oninput="filterMonitor()">
        <button class="btn-primary" onclick="loadMonitorLogs()" style="padding:10px 16px"><i class="fas fa-sync"></i> Refresh</button>
      </div>
      <div class="live-logs" id="monitorLogs"><div style="color:var(--text-muted);text-align:center;padding:20px">Loading...</div></div>
    </div>

    <!-- IP Request Stats -->
    <div class="glow-card" id="section-ipstats" style="display:none">
      <h3><i class="fas fa-network-wired"></i> IP Request Statistics (Last Hour)</h3>
      <div class="table-container" style="max-height:500px">
        <table>
          <thead><tr><th>IP</th><th>Last 10s</th><th>Last 1min</th><th>Last 1hr</th><th>Total</th><th>Status</th><th>Action</th></tr></thead>
          <tbody id="ipStatsBody"><tr><td colspan="7" style="text-align:center;color:var(--text-muted)">Loading...</td></tr></tbody>
        </table>
      </div>
      <button class="btn-primary" onclick="loadIPStats()" style="margin-top:12px;width:100%"><i class="fas fa-sync"></i> REFRESH</button>
    </div>

    <!-- Statistics -->
    <div class="glow-card" id="section-stats" style="display:none">
      <h3><i class="fas fa-chart-bar"></i> Detailed Statistics</h3>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-value" id="statTotalReqs">-</div><div class="stat-label">Total Requests</div></div>
        <div class="stat-card"><div class="stat-value" id="statTodayReqs">-</div><div class="stat-label">Today</div></div>
        <div class="stat-card"><div class="stat-value" id="statWeekReqs">-</div><div class="stat-label">This Week</div></div>
        <div class="stat-card"><div class="stat-value" id="statMonthReqs">-</div><div class="stat-label">This Month</div></div>
      </div>
      <h3><i class="fas fa-trophy"></i> Most Used Endpoints</h3>
      <div class="table-container">
        <table>
          <thead><tr><th>Endpoint</th><th>Requests</th></tr></thead>
          <tbody id="topEndpointsBody"></tbody>
        </table>
      </div>
      <h3><i class="fas fa-laptop"></i> Client Types</h3>
      <div class="table-container">
        <table>
          <thead><tr><th>Client</th><th>Requests</th></tr></thead>
          <tbody id="clientStatsBody"></tbody>
        </table>
      </div>
    </div>

    <!-- Import -->
    <div class="glow-card" id="section-import" style="display:none">
      <h3><i class="fas fa-download"></i> Import Keys (JSON)</h3>
      <p style="color:var(--text-muted);font-size:11px;margin-bottom:12px">Paste JSON data. Supports nested formats.</p>
      <textarea class="form-input" id="importData" rows="10" placeholder='{"MY_KEY":{"name":"User","scopes":["*"],"limit":100,...}}' style="font-family:'Space Grotesk',monospace;font-size:11px"></textarea>
      <button class="btn-primary" onclick="importKeys()" style="width:100%;margin-top:12px"><i class="fas fa-download"></i> IMPORT KEYS</button>
      <p id="importMsg" style="margin-top:10px;text-align:center;font-size:12px"></p>
    </div>

    <!-- Export -->
    <div class="glow-card" id="section-export" style="display:none">
      <h3><i class="fas fa-upload"></i> Export Keys</h3>
      <p style="color:var(--text-muted);font-size:11px;margin-bottom:12px">Exports all generated keys.</p>
      <textarea class="form-input" id="exportData" rows="10" readonly style="color:var(--neon-green);font-family:'Space Grotesk',monospace;font-size:11px"></textarea>
      <div style="display:flex;gap:12px;margin-top:12px">
        <button class="btn-primary" onclick="loadExport()" style="flex:1"><i class="fas fa-sync"></i> LOAD</button>
        <button class="btn-primary btn-success" onclick="copyExport()" style="flex:1"><i class="fas fa-copy"></i> COPY</button>
      </div>
    </div>

    <!-- Scopes -->
    <div class="glow-card" id="section-scopes" style="display:none">
      <h3><i class="fas fa-crosshairs"></i> Update Key Scopes</h3>
      <div class="form-group"><label>Key Name</label><input class="form-input" id="sk" placeholder="Enter key name"></div>
      <div class="form-group">
        <label>Select Scopes</label>
        <div style="display:flex;flex-wrap:wrap;gap:8px;padding:12px;background:rgba(255,45,45,0.05);border-radius:10px;max-height:300px;overflow-y:auto">
          <label style="cursor:pointer;font-size:11px;color:var(--neon-red)"><input type="checkbox" value="*" id="scope-all2"> 🌟 ALL</label>
          ${Object.keys(endpoints).map(e=>`<label style="cursor:pointer;font-size:10px"><input type="checkbox" value="${e}" class="scope-cb2"> ${endpoints[e].i} ${e}</label>`).join('')}
          <label style="cursor:pointer;font-size:11px;color:var(--neon-green)"><input type="checkbox" value="custom" class="scope-cb2"> 🔧 ALL Custom</label>
          ${customAPIs.map(a=>`<label style="cursor:pointer;font-size:10px;color:var(--neon-cyan)"><input type="checkbox" value="custom:${a.endpoint}" class="scope-cb2"> 🔧 ${a.name}</label>`).join('')}
        </div>
      </div>
      <button class="btn-primary" onclick="updateScopes()" style="width:100%"><i class="fas fa-save"></i> UPDATE SCOPES</button>
    </div>

    <!-- Push -->
    <div class="glow-card" id="section-push" style="display:none">
      <h3><i class="fas fa-arrow-up"></i> Push Key Expiry</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group"><label>Key Name</label><input class="form-input" id="pk" placeholder="Enter key name"></div>
        <div class="form-group"><label>Days</label><input class="form-input" id="pd" type="number" value="30"></div>
      </div>
      <button class="btn-primary" onclick="pushKeyAction()" style="width:100%"><i class="fas fa-arrow-up"></i> PUSH KEY</button>
    </div>

    <!-- Protection -->
    <div class="glow-card" id="section-protect" style="display:none">
      <h3><i class="fas fa-shield-alt"></i> Data Protection</h3>
      <div class="form-group"><label>Value to Protect</label><input class="form-input" id="protVal" placeholder="e.g., 9876543210"></div>
      <button class="btn-primary" onclick="addProtection()" style="width:100%"><i class="fas fa-lock"></i> ADD PROTECTION</button>
      <div class="table-container" style="margin-top:20px">
        <table>
          <thead><tr><th>Value</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>${protHTML}</tbody>
        </table>
      </div>
    </div>

    <!-- APIs -->
    <div class="glow-card" id="section-apis" style="display:none">
      <h3><i class="fas fa-plug"></i> Custom APIs (${customAPIs.length})</h3>
      <div class="table-container" style="max-height:350px">
        <table>
          <thead><tr><th>ID</th><th>Name</th><th>Endpoint</th><th>Param</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${apiHTML}</tbody>
        </table>
      </div>
    </div>

    <!-- Add API -->
    <div class="glow-card" id="section-addapi" style="display:none">
      <h3><i class="fas fa-puzzle-piece"></i> Add Custom API</h3>
      <div class="form-group"><label>API Name</label><input class="form-input" id="aname" placeholder="My API"></div>
      <div class="form-group"><label>Endpoint</label><input class="form-input" id="aep" placeholder="my-api"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group"><label>Param</label><input class="form-input" id="aparam" value="num"></div>
        <div class="form-group"><label>Example</label><input class="form-input" id="aex" placeholder="9876543210"></div>
      </div>
      <div class="form-group"><label>Real URL ({param})</label><input class="form-input" id="aurl" placeholder="https://api.com?param={param}"></div>
      <button class="btn-primary" onclick="addAPI()" style="width:100%"><i class="fas fa-plus"></i> ADD API</button>
    </div>

    <!-- Banned IPs -->
    <div class="glow-card" id="section-bannedips" style="display:none">
      <h3><i class="fas fa-ban"></i> Banned IPs (${Object.keys(bannedIPs).length})</h3>
      <div style="display:flex;gap:12px;margin-bottom:14px">
        <input class="form-input" id="banIPInput" placeholder="Enter IP to ban (e.g. 1.2.3.4)" style="flex:1">
        <button class="btn-primary btn-danger" onclick="banIPManual()" style="padding:10px 18px"><i class="fas fa-ban"></i> BAN IP</button>
      </div>
      <div class="table-container" style="max-height:500px">
        <table>
          <thead><tr><th>IP</th><th>Reason</th><th>Banned At</th><th>Until</th><th>Action</th></tr></thead>
          <tbody id="bannedIPsBody">${bannedIPsHTML}</tbody>
        </table>
      </div>
      <button class="btn-primary btn-warning" onclick="clearAllBannedIPs()" style="margin-top:12px;width:100%"><i class="fas fa-unlock"></i> UNBAN ALL IPs</button>
    </div>

    <!-- Banned Devices -->
    <div class="glow-card" id="section-banneddevices" style="display:none">
      <h3><i class="fas fa-mobile-alt"></i> Banned Devices (${Object.keys(bannedDevices).length})</h3>
      <div class="table-container" style="max-height:500px">
        <table>
          <thead><tr><th>Device ID</th><th>Reason</th><th>Banned At</th><th>Action</th></tr></thead>
          <tbody id="bannedDevicesBody">${bannedDevicesHTML}</tbody>
        </table>
      </div>
      <button class="btn-primary btn-warning" onclick="clearAllBannedDevices()" style="margin-top:12px;width:100%"><i class="fas fa-unlock"></i> UNBAN ALL DEVICES</button>
    </div>

    <!-- Devices -->
    <div class="glow-card" id="section-devices" style="display:none">
      <h3><i class="fas fa-laptop"></i> All Devices (${Object.keys(deviceFingerprints).length})</h3>
      <div class="table-container" style="max-height:600px">
        <table>
          <thead><tr><th>Device ID</th><th>Type</th><th>OS</th><th>Browser</th><th>Requests</th><th>First Seen</th><th>Last Seen</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>${devicesHTML}</tbody>
        </table>
      </div>
      <button class="btn-primary" onclick="location.reload()" style="margin-top:12px;width:100%"><i class="fas fa-sync"></i> REFRESH</button>
    </div>

    <!-- Rate Limit / DDoS -->
    <div class="glow-card" id="section-ratelimit" style="display:none">
      <h3><i class="fas fa-tachometer-alt"></i> DDOS Protection & Rate Limit Config</h3>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
        <div class="form-group"><label>Max Req / 10 sec</label><input class="form-input" id="rl10s" type="number" value="${rateLimitConfig.maxRequestsPer10Sec}"></div>
        <div class="form-group"><label>Max Req / minute</label><input class="form-input" id="rl1m" type="number" value="${rateLimitConfig.maxRequestsPerMinute}"></div>
        <div class="form-group"><label>Max Req / hour</label><input class="form-input" id="rl1h" type="number" value="${rateLimitConfig.maxRequestsPerHour}"></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
        <div class="form-group"><label>Max Login Attempts</label><input class="form-input" id="rlLogin" type="number" value="${rateLimitConfig.loginAttemptsMax}"></div>
        <div class="form-group"><label>Login Ban Duration (ms)</label><input class="form-input" id="rlLoginBan" type="number" value="${rateLimitConfig.loginBanDuration}"></div>
        <div class="form-group"><label>Auto Ban Duration (ms)</label><input class="form-input" id="rlAutoBan" type="number" value="${rateLimitConfig.autoBanDuration}"></div>
      </div>
      <button class="btn-primary" onclick="updateRateLimit()" style="width:100%"><i class="fas fa-save"></i> SAVE CONFIG</button>
      <p style="color:var(--neon-orange);font-size:10px;margin-top:10px">⚠️ After 10-sec limit is exceeded, the IP is automatically BANNED PERMANENTLY. Be careful!</p>
    </div>

    <!-- Admin Logs -->
    <div class="glow-card" id="section-adminlogs" style="display:none">
      <h3><i class="fas fa-history"></i> Admin Login Logs</h3>
      <div class="table-container" style="max-height:500px">
        <table>
          <thead><tr><th>Time</th><th>User</th><th>Action</th><th>IP</th><th>Device</th><th>Browser</th><th>Status</th></tr></thead>
          <tbody id="adminLogsBody"><tr><td colspan="7" style="text-align:center;color:var(--text-muted)">Loading...</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- Settings -->
    <div class="glow-card" id="section-settings" style="display:none">
      <h3><i class="fas fa-cog"></i> System Settings</h3>
      <div class="form-group">
        <label>Theme Mode</label>
        <select class="form-input" id="themeSelect">
          <option value="neon" selected>🌈 Neon Ultra (Red/Green/Orange/Cyan/Pink)</option>
        </select>
      </div>
      <button class="btn-primary btn-danger" onclick="resetAll()" style="width:100%;margin-bottom:12px"><i class="fas fa-sync-alt"></i> RESET ALL USAGE</button>
      <button class="btn-primary btn-danger" onclick="clearLogs()" style="width:100%;margin-bottom:12px"><i class="fas fa-trash"></i> CLEAR ALL LOGS</button>
      <button class="btn-primary btn-warning" onclick="clearAllBannedIPs()" style="width:100%;margin-bottom:12px"><i class="fas fa-unlock"></i> UNBAN ALL IPs & DEVICES</button>
    </div>
  </div>
</div>

<script>
const TOKEN='${stoken}';
const ADMIN_PATH='${ADMIN_PATH}';
const sc=document.getElementById('snowfall-canvas'),sctx=sc.getContext('2d');sc.width=window.innerWidth;sc.height=window.innerHeight;
const colors=['255,45,45','0,255,136','255,149,0','255,45,149','0,229,255','191,0,255','255,230,0'];
const snow=[];for(let i=0;i<100;i++)snow.push({x:Math.random()*sc.width,y:Math.random()*sc.height,s:Math.random()*3+1,sp:Math.random()*1+.3,w:Math.random()*.5-.25,o:Math.random()*.6+.2,c:colors[Math.floor(Math.random()*colors.length)]});
function as(){sctx.clearRect(0,0,sc.width,sc.height);snow.forEach(s=>{s.y+=s.sp;s.x+=s.w;if(s.y>sc.height){s.y=-5;s.x=Math.random()*sc.width}if(s.x<0)s.x=sc.width;if(s.x>sc.width)s.x=0;sctx.beginPath();sctx.arc(s.x,s.y,s.s,0,Math.PI*2);sctx.fillStyle='rgba('+s.c+','+s.o+')';sctx.shadowBlur=10;sctx.shadowColor='rgba('+s.c+',0.8)';sctx.fill();sctx.shadowBlur=0});requestAnimationFrame(as)}as();

function switchSection(sectionName, el){
  document.querySelectorAll('.glow-card').forEach(card=>card.style.display='none');
  const section=document.getElementById('section-'+sectionName);
  if(section)section.style.display='block';
  document.querySelectorAll('.sidebar-nav a').forEach(a=>a.classList.remove('active'));
  if(el) el.classList.add('active');
  if(sectionName==='dashboard')loadDashboardStats();
  if(sectionName==='monitor')loadMonitorLogs();
  if(sectionName==='ipstats')loadIPStats();
  if(sectionName==='adminlogs')loadAdminLogs();
  if(sectionName==='stats')loadStats();
  if(sectionName==='responses')loadResponse();
  if(sectionName==='bannedips')loadBannedIPs();
  if(sectionName==='banneddevices')loadBannedDevices();
}

function showToast(msg,type='success'){
  const toast=document.createElement('div');toast.className='toast '+type;toast.innerHTML=msg;
  document.body.appendChild(toast);setTimeout(()=>toast.remove(),3500);
}

async function apiCall(url,data=null){
  const options={method:data?'POST':'GET',headers:{'Content-Type':'application/json','x-admin-token':TOKEN}};
  if(data)options.body=JSON.stringify(data);
  const res=await fetch(ADMIN_PATH+url,options);return await res.json();
}

function randomKey(){
  const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let r='';
  for(let i=0;i<20;i++)r+=chars.charAt(Math.floor(Math.random()*chars.length));
  document.getElementById('gk').value='BRONX_'+r;
  showToast('🎲 Random key generated!','warning');
}

async function generateKey(){
  const keyName=document.getElementById('gk').value.trim(),keyOwner=document.getElementById('go').value.trim();
  if(!keyOwner){showToast('⚠ Enter Owner Name','error');return}
  let scopes=[];if(document.getElementById('scope-all').checked)scopes=['*'];
  else document.querySelectorAll('.scope-cb:checked').forEach(c=>scopes.push(c.value));
  const data={keyName,keyOwner,scopes,limit:document.getElementById('gl').value,dailyLimit:parseInt(document.getElementById('gdl').value)||0,perSecondLimit:parseInt(document.getElementById('gpsl').value)||0,days:parseInt(document.getElementById('gd').value)||30,cooldown:parseInt(document.getElementById('gc').value)||0};
  const res=await apiCall('/generate-key',data);
  res.success?(showToast('✅ Key: '+res.key),setTimeout(()=>location.reload(),1500)):showToast('❌ '+(res.e||'Error'),'error');
}

async function resetKey(k){if(confirm('Reset usage?')){await apiCall('/reset-key-usage',{keyName:k});location.reload()}}
async function deleteKey(k){if(confirm('DELETE?')){await apiCall('/delete-key',{keyName:k});location.reload()}}
async function stopKey(k){if(!confirm('Stop/Activate?'))return;const res=await apiCall('/stop-key',{keyName:k});res.success?location.reload():showToast('❌ Error','error')}
async function disableKey(k){if(!confirm('Disable/Enable?'))return;const res=await apiCall('/disable-key',{keyName:k});res.success?location.reload():showToast('❌ Error','error')}
async function pushKey(k){const d=prompt('Days?','30');if(!d)return;const res=await apiCall('/push-key',{keyName:k,days:parseInt(d)});res.success?(showToast('✅ '+res.message),setTimeout(()=>location.reload(),1000)):showToast('❌ Error','error')}
async function editKey(k){
  const newName=prompt('New key ID (leave empty to keep):','')||k;
  const newOwner=prompt('New owner name (leave empty to keep):','');
  const newLimit=prompt('New total limit (leave empty to keep):','');
  const newDaily=prompt('New daily limit (0=∞):','');
  const newPS=prompt('New per-second limit (0=∞):','');
  const newCD=prompt('New cooldown (sec):','');
  const res=await apiCall('/edit-key',{keyName:k,newName:newName||k,newOwner:newOwner||undefined,newLimit:newLimit||undefined,newDailyLimit:newDaily!==''?parseInt(newDaily):undefined,newPerSecondLimit:newPS!==''?parseInt(newPS):undefined,newCooldown:newCD!==''?parseInt(newCD):undefined});
  res.success?(showToast('✅ Key updated!'),setTimeout(()=>location.reload(),1000)):showToast('❌ '+(res.e||'Error'),'error');
}
async function pushKeyAction(){const k=document.getElementById('pk').value.trim(),d=parseInt(document.getElementById('pd').value)||30;if(!k){showToast('⚠ Enter key name','error');return}const res=await apiCall('/push-key',{keyName:k,days:d});res.success?(showToast('✅ '+res.message),setTimeout(()=>location.reload(),1000)):showToast('❌ Error','error')}
async function updateScopes(){const k=document.getElementById('sk').value.trim();if(!k){showToast('⚠ Enter key name','error');return}let scopes=[];if(document.getElementById('scope-all2').checked)scopes=['*'];else document.querySelectorAll('.scope-cb2:checked').forEach(c=>scopes.push(c.value));const res=await apiCall('/update-scopes',{keyName:k,scopes});res.success?(showToast('✅ Updated'),setTimeout(()=>location.reload(),1000)):showToast('❌ Error','error')}
async function addProtection(){const v=document.getElementById('protVal').value.trim();if(!v)return;const res=await apiCall('/add-protection',{value:v});res.success?(showToast(res.message),setTimeout(()=>location.reload(),1000)):showToast('❌ Error','error')}
async function removeProt(v){if(!confirm('Remove?'))return;await apiCall('/remove-protection',{value:v});location.reload()}
async function addAPI(){const n=document.getElementById('aname').value.trim(),e=document.getElementById('aep').value.trim();if(!n||!e){showToast('⚠ Fill name & endpoint','error');return}const res=await apiCall('/add-api',{name:n,endpoint:e,param:document.getElementById('aparam').value,example:document.getElementById('aex').value,realAPI:document.getElementById('aurl').value,visible:true});res.success?(showToast('✅ Added!'),setTimeout(()=>location.reload(),1000)):showToast('❌ Error','error')}
async function toggleAPI(id){await apiCall('/toggle-api',{id});location.reload()}
async function deleteAPI(id){if(confirm('Delete?')){await apiCall('/delete-api',{id});location.reload()}}
async function resetAll(){if(confirm('Reset ALL?')){await apiCall('/reset-all');showToast('✅ Reset');setTimeout(()=>location.reload(),1000)}}
async function clearLogs(){if(confirm('Clear ALL?')){await apiCall('/clear-logs');showToast('✅ Cleared');setTimeout(()=>location.reload(),1000)}}
async function banIPManual(){
  const ip=document.getElementById('banIPInput').value.trim();
  if(!ip){showToast('⚠ Enter IP','error');return}
  const reason=prompt('Reason?','Manual ban')||'Manual ban';
  const res=await apiCall('/ban-ip',{ip,reason,permanent:false});
  res.success?(showToast('✅ '+res.message),setTimeout(()=>location.reload(),1000)):showToast('❌ '+(res.e||'Error'),'error');
}
async function unbanIP(ip){if(!confirm('Unban '+ip+'?'))return;const res=await apiCall('/unban-ip',{ip});res.success?(showToast('✅ '+res.message),setTimeout(()=>location.reload(),1000)):showToast('❌ Error','error')}
async function banDevice(deviceId){if(!confirm('Ban this device?'))return;const reason=prompt('Reason?','Manual ban')||'Manual ban';const res=await apiCall('/ban-device',{deviceId,reason,permanent:false});res.success?(showToast('✅ '+res.message),setTimeout(()=>location.reload(),1000)):showToast('❌ Error','error')}
async function unbanDevice(deviceId){if(!confirm('Unban?'))return;const res=await apiCall('/unban-device',{deviceId});res.success?(showToast('✅ '+res.message),setTimeout(()=>location.reload(),1000)):showToast('❌ Error','error')}
async function clearAllBannedIPs(){if(!confirm('Unban ALL IPs & Devices?'))return;await apiCall('/clear-all-banned-ips');await apiCall('/clear-all-banned-devices');showToast('✅ All unbanned');setTimeout(()=>location.reload(),1000)}
async function clearAllBannedDevices(){if(!confirm('Unban ALL devices?'))return;await apiCall('/clear-all-banned-devices');showToast('✅ All devices unbanned');setTimeout(()=>location.reload(),1000)}
async function loadBannedIPs(){const res=await apiCall('/banned-ips');if(res.banned){const tbody=document.getElementById('bannedIPsBody');tbody.innerHTML=res.banned.map(b=>'<tr><td><code style="color:var(--neon-red)">'+b.ip+'</code></td><td style="color:var(--neon-orange);font-size:10px">'+b.reason+'</td><td style="font-size:9px">'+b.bannedAt+'</td><td>'+b.banUntil+'</td><td><button class="btn-action btn-reset" onclick="unbanIP(\\''+b.ip+'\\')"><i class="fas fa-unlock"></i> Unban</button></td></tr>').join('')||'<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No banned IPs</td></tr>'}}
async function loadBannedDevices(){const res=await apiCall('/banned-devices');if(res.banned){const tbody=document.getElementById('bannedDevicesBody');tbody.innerHTML=res.banned.map(b=>'<tr><td><code style="color:var(--neon-pink);font-size:9px">'+b.deviceId.substring(0,25)+'..</code></td><td style="color:var(--neon-orange);font-size:10px">'+b.reason+'</td><td style="font-size:9px">'+b.bannedAt+'</td><td><button class="btn-action btn-reset" onclick="unbanDevice(\\''+b.deviceId+'\\')"><i class="fas fa-unlock"></i> Unban</button></td></tr>').join('')||'<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No banned devices</td></tr>'}}
async function importKeys(){const d=document.getElementById('importData').value.trim(),msg=document.getElementById('importMsg');if(!d){msg.style.color='#ff2d2d';msg.textContent='❌ Paste JSON first!';return}try{let jsonData=JSON.parse(d);const res=await apiCall('/import-keys',jsonData);if(res.success){msg.style.color='#00ff88';msg.textContent='✅ '+res.message;setTimeout(()=>location.reload(),1500)}else{msg.style.color='#ff2d2d';msg.textContent='❌ '+(res.e||'Error')}}catch(e){msg.style.color='#ff2d2d';msg.textContent='❌ Invalid JSON!'}}
let exportData='';
async function loadExport(){const res=await apiCall('/export-keys');if(res.success){exportData=JSON.stringify(res,null,2);document.getElementById('exportData').value=exportData;showToast('✅ Loaded')}else showToast('❌ Error','error')}
async function copyExport(){const ta=document.getElementById('exportData');if(!ta.value){showToast('⚠ Click LOAD first!','error');return}try{await navigator.clipboard.writeText(ta.value);showToast('✅ Copied!')}catch(e){ta.select();document.execCommand('copy');showToast('✅ Copied!')}}
async function updateRateLimit(){
  const data={
    maxRequestsPer10Sec:document.getElementById('rl10s').value,
    maxRequestsPerMinute:document.getElementById('rl1m').value,
    maxRequestsPerHour:document.getElementById('rl1h').value,
    loginAttemptsMax:document.getElementById('rlLogin').value,
    loginBanDuration:document.getElementById('rlLoginBan').value,
    autoBanDuration:document.getElementById('rlAutoBan').value
  };
  const res=await apiCall('/rate-limit-config',data);
  res.success?showToast('✅ Rate limit updated!'):showToast('❌ Error','error');
}
async function loadIPStats(){
  try{
    const res=await apiCall('/ip-request-stats');
    const tbody=document.getElementById('ipStatsBody');
    if(res.stats){
      tbody.innerHTML=res.stats.map(s=>{
        const statusColor=s.isBanned?'#ff2d2d':'#00ff88';
        const statusText=s.isBanned?'🚫 BANNED':'🟢 OK';
        let color10s='#00ff88',color1m='#00ff88',color1h='#00ff88';
        if(s.reqs10s>10)color10s='#ff9500';
        if(s.reqs10s>20)color10s='#ff2d2d';
        if(s.reqs1m>50)color1m='#ff9500';
        if(s.reqs1m>80)color1m='#ff2d2d';
        if(s.reqs1h>300)color1h='#ff9500';
        return '<tr><td><code style="color:var(--neon-cyan)">'+s.ip+'</code></td><td style="color:'+color10s+'">'+s.reqs10s+'</td><td style="color:'+color1m+'">'+s.reqs1m+'</td><td style="color:'+color1h+'">'+s.reqs1h+'</td><td>'+s.total+'</td><td style="color:'+statusColor+'">'+statusText+'</td><td><button class="btn-action btn-stop" onclick="banIPManual2(\\''+s.ip+'\\')"><i class="fas fa-ban"></i></button></td></tr>';
      }).join('')||'<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">No data yet</td></tr>';
    }
  }catch(e){}
}
async function banIPManual2(ip){if(!confirm('Ban '+ip+'?'))return;const res=await apiCall('/ban-ip',{ip,reason:'Manual ban from IP stats',permanent:false});res.success?(showToast('✅ Banned '+ip),loadIPStats()):showToast('❌ Error','error')}
async function loadDashboardStats(){
  try{const res=await apiCall('/stats');if(res){document.getElementById('dashToday').textContent=res.todayRequests||0;document.getElementById('dashWeek').textContent=res.weeklyRequests||0;document.getElementById('dashMonth').textContent=res.monthlyRequests||0;document.getElementById('dashTotal').textContent=res.totalRequests||0;document.getElementById('statToday').textContent=res.todayRequests||0;document.getElementById('statTotal').textContent=res.totalRequests||0;if(res.topKeys){const tbody=document.getElementById('topKeysBody');tbody.innerHTML=res.topKeys.map(k=>'<tr><td style="color:var(--neon-red)">'+k.key+'</td><td>'+k.requests+'</td><td style="color:#00ff88">🟢 Active</td></tr>').join('')||'<tr><td colspan="3" style="color:var(--text-muted)">No data</td></tr>'}if(res.topIPs){const itbody=document.getElementById('topIPsBody');itbody.innerHTML=res.topIPs.map(k=>'<tr><td style="color:var(--neon-cyan)">'+k.ip+'</td><td>'+k.requests+'</td><td style="color:#00ff88">🟢 OK</td></tr>').join('')||'<tr><td colspan="3" style="color:var(--text-muted)">No data</td></tr>'}}}catch(e){}
}
let allMonitorLogs=[];
async function loadMonitorLogs(){
  try{const res=await apiCall('/monitor-logs');allMonitorLogs=res.logs?res.logs.reverse():[];renderMonitor()}
  catch(e){}
}
function renderMonitor(){
  const c=document.getElementById('monitorLogs');
  const filter=(document.getElementById('monitorFilter')?.value||'').toLowerCase();
  const filtered=filter?allMonitorLogs.filter(l=>(l.ip||'').toLowerCase().includes(filter)||(l.key||'').toLowerCase().includes(filter)||(l.endpoint||'').toLowerCase().includes(filter)||(l.deviceType||'').toLowerCase().includes(filter)||(l.browser||'').toLowerCase().includes(filter)):allMonitorLogs;
  c.innerHTML=filtered.slice(0,200).map(l=>'<div class="log-entry"><span class="log-time">'+l.timestamp+'</span><span class="log-key">'+l.key+'</span><span class="log-endpoint">/'+l.endpoint+'</span><span class="log-ip">'+l.ip+'</span><span class="log-device">'+(l.deviceIcon||'❓')+' '+(l.deviceType||'Unknown')+'</span><span class="log-browser">'+l.browser+'</span></div>').join('')||'<div style="color:var(--text-muted);text-align:center;padding:20px">No logs</div>';
}
function filterMonitor(){renderMonitor()}
async function loadAdminLogs(){
  try{const res=await apiCall('/admin-logs');const tbody=document.getElementById('adminLogsBody');if(res&&res.logs){tbody.innerHTML=res.logs.reverse().map(l=>{const sc=l.status==='SUCCESS'?'#00ff88':(l.status==='FAILED'?'#ff9500':'#ff2d2d');return '<tr><td>'+l.timestamp+'</td><td>'+l.user+'</td><td>'+l.action+'</td><td>'+l.ip+'</td><td>'+l.device+'</td><td style="font-size:9px">'+(l.browser||'').substring(0,40)+'</td><td style="color:'+sc+'">'+l.status+'</td></tr>'}).join('')||'<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">No logs</td></tr>'}}catch(e){}
}
async function loadStats(){
  try{const res=await apiCall('/stats');if(res){
    document.getElementById('statTotalReqs').textContent=res.totalRequests||0;
    document.getElementById('statTodayReqs').textContent=res.todayRequests||0;
    document.getElementById('statWeekReqs').textContent=res.weeklyRequests||0;
    document.getElementById('statMonthReqs').textContent=res.monthlyRequests||0;
    const epBody=document.getElementById('topEndpointsBody');
    epBody.innerHTML=res.topEndpoints?res.topEndpoints.map(e=>'<tr><td style="color:var(--neon-orange)">/'+e.endpoint+'</td><td>'+e.requests+'</td></tr>').join('')||'<tr><td colspan="2" style="color:var(--text-muted)">No data</td></tr>':'';
    const clientBody=document.getElementById('clientStatsBody');
    clientBody.innerHTML=res.clientStats?res.clientStats.map(c=>'<tr><td style="color:var(--neon-green)">'+c.client+'</td><td>'+c.requests+'</td></tr>').join('')||'<tr><td colspan="2" style="color:var(--text-muted)">No data</td></tr>':'';
  }}catch(e){}
}
function copyEndpoint(ep,param,example){
  const url=location.origin+'/api/key-bronx/'+ep+'?key=YOUR_KEY&'+param+'='+example;
  navigator.clipboard.writeText(url).then(()=>showToast('✅ Copied!')).catch(()=>showToast('⚠ Copy failed','error'));
}
async function loadResponse(){
  const ep=document.getElementById('responseEndpoint').value;
  const res=await apiCall('/get-endpoint-response?endpoint='+ep);
  document.getElementById('responseData').value=res.data?JSON.stringify(res.data,null,2):'';
}
async function updateResponse(){
  const ep=document.getElementById('responseEndpoint').value;
  const data=document.getElementById('responseData').value.trim();
  const res=await apiCall('/update-endpoint-response',{endpoint:ep,responseData:data});
  res.success?showToast('✅ Response updated!'):showToast('❌ '+(res.e||'Error'),'error');
}
loadDashboardStats();
</script></body></html>`;
    }catch(e){return `<html><body style="background:#0a0505;color:#ff2d2d;padding:30px;font-family:monospace"><h1>⚠️ ERROR</h1><pre>${e.message}\n${e.stack}</pre></body></html>`}
}

// ============================================
// NEON HOME PAGE
// ============================================
function renderHome(){
    const vapi=customAPIs.filter(a=>a.visible);
    let cards='';
    Object.entries(endpoints).forEach(([n,e])=>{
        cards+=`<div class="endpoint-card" onclick="copyEndpoint('${esc(n)}','${esc(e.p)}','${esc(e.e)}')">
            <div class="ep-icon">${e.i}</div>
            <div class="ep-name">/${esc(n)}</div>
            <div class="ep-desc">${e.d}</div>
            <div class="ep-url">GET /api/key-bronx/${n}?key=KEY&${e.p}=${e.e}</div>
        </div>`;
    });
    vapi.forEach(a=>{
        cards+=`<div class="endpoint-card" onclick="copyCustomEp('${esc(a.endpoint)}','${esc(a.param)}','${esc(a.example)}')">
            <div class="ep-icon">🔧</div>
            <div class="ep-name">/${esc(a.endpoint)}</div>
            <div class="ep-desc">Custom API</div>
            <div class="ep-url">GET /api/custom/${a.endpoint}?key=KEY&${a.param}=${a.example||'v'}</div>
        </div>`;
    });
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>BRONX OSINT V300 NEON ULTRA</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Orbitron:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
${NEON_CSS}
<style>
.topnav {
  position: sticky;
  top: 0;
  z-index: 1000;
  background: rgba(20, 8, 8, 0.95);
  backdrop-filter: var(--glass-blur);
  border-bottom: 1px solid rgba(255,45,45,0.2);
  padding: 14px 28px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  box-shadow: 0 5px 30px rgba(255,45,45,0.1);
}
.brand {
  font-family: 'Orbitron', sans-serif;
  font-size: 15px;
  font-weight: 900;
  letter-spacing: 5px;
  background: var(--gradient-rainbow);
  background-size: 500% 500%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: rainbowShift 3s linear infinite;
  text-decoration: none;
  text-shadow: 0 0 30px rgba(255,45,45,0.5);
}
.nav-links { display: flex; gap: 10px; align-items: center; }
.nav-links a {
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 11px;
  font-weight: 600;
  padding: 8px 14px;
  border-radius: 10px;
  transition: var(--transition);
  border: 1px solid transparent;
  letter-spacing: 1px;
}
.nav-links a:hover {
  color: var(--neon-red);
  border-color: rgba(255,45,45,0.5);
  background: rgba(255,45,45,0.08);
  box-shadow: 0 0 20px rgba(255,45,45,0.4);
  text-shadow: 0 0 10px var(--neon-red);
}
.hero { text-align: center; padding: 60px 20px 40px; position: relative; z-index: 10; }
.hero h1 {
  font-size: clamp(34px, 7vw, 60px);
  font-weight: 900;
  background: var(--gradient-rainbow);
  background-size: 500% 500%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-family: 'Orbitron', sans-serif;
  animation: rainbowShift 4s linear infinite;
  margin-bottom: 12px;
  filter: drop-shadow(0 0 30px rgba(255,45,45,0.5));
}
.hero p {
  color: var(--text-muted);
  font-size: 11px;
  letter-spacing: 5px;
  text-transform: uppercase;
}
.container { max-width: 1400px; margin: 0 auto; padding: 20px; position: relative; z-index: 10; }
.footer { text-align: center; padding: 24px; border-top: 1px solid rgba(255,45,45,0.15); position: relative; z-index: 10; }
.footer span {
  font-weight: 900;
  background: var(--gradient-rainbow);
  background-size: 400% 400%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-family: 'Orbitron', sans-serif;
  letter-spacing: 3px;
  animation: rainbowShift 4s linear infinite;
}
.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 2px;
  background: rgba(0,255,136,0.1);
  color: var(--neon-green);
  border: 1px solid rgba(0,255,136,0.3);
  box-shadow: 0 0 15px rgba(0,255,136,0.3);
  margin-top: 10px;
}
</style></head><body>
<div class="grid-bg"></div>
<canvas id="snowfall-canvas"></canvas>
<nav class="topnav">
  <a href="/" class="brand">🛡️ BRONX V300 NEON</a>
  <div class="nav-links">
    <a href="/test"><i class="fas fa-heartbeat"></i> STATUS</a>
    <span class="status-badge"><i class="fas fa-circle" style="font-size:6px;color:var(--neon-green)"></i> ONLINE</span>
  </div>
</nav>
<header class="hero">
  <h1>BRONX OSINT V300</h1>
  <p>Neon Ultra · DDOS Protected · Device Tracking · Real IP Monitor</p>
</header>
<div class="container">
  <div class="endpoint-grid">${cards}</div>
</div>
<footer class="footer">
  <span>BRONX OSINT V300 NEON ULTRA 🛡️</span>
</footer>
<script>
function copyEndpoint(n,p,e){
  navigator.clipboard.writeText(location.origin+'/api/key-bronx/'+n+'?key=YOUR_KEY&'+p+'='+e).then(()=>showToast('✅ URL Copied!')).catch(()=>showToast('⚠ Copy failed','error'));
}
function copyCustomEp(n,p,e){
  navigator.clipboard.writeText(location.origin+'/api/custom/'+n+'?key=YOUR_KEY&'+p+'='+(e||'v')).then(()=>showToast('✅ URL Copied!')).catch(()=>showToast('⚠ Copy failed','error'));
}
function showToast(msg,type='success'){
  const toast=document.createElement('div');toast.className='toast '+type;toast.innerHTML=msg;
  document.body.appendChild(toast);setTimeout(()=>toast.remove(),3000);
}
const sc=document.getElementById('snowfall-canvas'),sctx=sc.getContext('2d');sc.width=window.innerWidth;sc.height=window.innerHeight;
const colors=['255,45,45','0,255,136','255,149,0','255,45,149','0,229,255','191,0,255','255,230,0'];
const snow=[];for(let i=0;i<100;i++)snow.push({x:Math.random()*sc.width,y:Math.random()*sc.height,s:Math.random()*3+1,sp:Math.random()*1+.3,w:Math.random()*.5-.25,o:Math.random()*.6+.2,c:colors[Math.floor(Math.random()*colors.length)]});
function as(){sctx.clearRect(0,0,sc.width,sc.height);snow.forEach(s=>{s.y+=s.sp;s.x+=s.w;if(s.y>sc.height){s.y=-5;s.x=Math.random()*sc.width}if(s.x<0)s.x=sc.width;if(s.x>sc.width)s.x=0;sctx.beginPath();sctx.arc(s.x,s.y,s.s,0,Math.PI*2);sctx.fillStyle='rgba('+s.c+','+s.o+')';sctx.shadowBlur=10;sctx.shadowColor='rgba('+s.c+',0.8)';sctx.fill();sctx.shadowBlur=0});requestAnimationFrame(as)}as();
</script></body></html>`;
}

const PORT = process.env.PORT || 3000;
(async function(){
    initHardcodedKeys();
    if(!loadFromDisk()){if(customAPIs.length===0)initCustomAPIs()}
    if(!keyStorage[MASTER_API_KEY])keyStorage[MASTER_API_KEY]=createMasterKey();
    scheduleSave();
    app.listen(PORT,()=>{
        console.log('🛡️ BRONX OSINT V300 NEON ULTRA ONLINE!');
        console.log('🌈 Neon Red/Green/Orange/Cyan/Pink Theme ACTIVE');
        console.log('🛡️ DDOS Protection ACTIVE (10s/1m/1h limits)');
        console.log('🚫 IP Ban System ACTIVE');
        console.log('📱 Device Fingerprinting ACTIVE');
        console.log('🔐 Hidden Admin: '+ADMIN_PATH);
        console.log('🎲 Random Key Generator ACTIVE');
        console.log('📊 Advanced Monitor with Filters ACTIVE');
        console.log('🚀 PORT: '+PORT);
    });
})();
module.exports = app;
