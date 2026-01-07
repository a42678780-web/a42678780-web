require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const cron = require('node-cron');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const winston = require('winston');
const rateLimit = require('express-rate-limit');

const { fetchLatest539, fetchHistory539 } = require('./services/fetch539');
const AuthService = require('./services/auth');
const AnalysisService = require('./services/analysis');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const RESULTS_PATH = path.join(DATA_DIR, 'results.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backup');

const LOG_DIR = path.join(DATA_DIR, 'logs');
const ACTION_LOG_PATH = path.join(LOG_DIR, 'action.log');

// --- Logger Setup ---
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: '539-service' },
  transports: [
    new winston.transports.File({ filename: path.join(LOG_DIR, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(LOG_DIR, 'combined.log') }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

// --- Middleware ---
app.set('trust proxy', 1); // Trust first proxy (necessary for rate limiting behind load balancers)
app.use(helmet({
    contentSecurityPolicy: false, // Disable strictly for this demo to allow inline scripts/styles if needed, or configure properly
}));
app.use(compression());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(cors());
app.use(express.json());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { ok: false, error: '請求過於頻繁，請稍後再試' }
});
app.use('/api/', limiter);

app.use(express.static(path.join(__dirname, '..', 'public')));

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}
if (!fs.existsSync(RESULTS_PATH)) {
  fs.writeFileSync(RESULTS_PATH, JSON.stringify([]), 'utf-8');
}

function writeLog(action, details) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${action}] ${details}\n`;
    fs.appendFileSync(ACTION_LOG_PATH, logLine, 'utf-8');
}

const FEEDBACK_LOG_PATH = path.join(LOG_DIR, 'feedback.log');

app.post('/api/feedback', (req, res) => {
    const { message, contact } = req.body;
    if (!message) return res.status(400).json({ ok: false, error: '請輸入內容' });
    
    const entry = {
        timestamp: new Date().toISOString(),
        message,
        contact: contact || 'Anonymous',
        ip: req.ip
    };
    
    fs.appendFileSync(FEEDBACK_LOG_PATH, JSON.stringify(entry) + '\n', 'utf-8');
    res.json({ ok: true });
});

function readResults() {
  try {
    const raw = fs.readFileSync(RESULTS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeResults(results) {
  // 備份
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `results-${timestamp}.json`);
  // 只保留最近 5 個備份，避免無限增長 (簡單實作: 略過刪除舊備份，僅寫入)
  try {
     // 為了不塞滿硬碟，如果是小改動可以不備份，這裡選擇每次寫入前備份原檔
     if (fs.existsSync(RESULTS_PATH)) {
         fs.copyFileSync(RESULTS_PATH, backupPath);
     }
  } catch (e) {
      console.warn('備份失敗:', e);
  }
  
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2), 'utf-8');
}

function upsertDraw(draw) {
  const results = readResults();
  const idx = results.findIndex(r => r.date === draw.date);
  if (idx >= 0) {
    // 保留 rawDate 如果新數據沒有
    if (!draw.rawDate && results[idx].rawDate) {
        draw.rawDate = results[idx].rawDate;
    }
    results[idx] = draw;
  } else {
    results.unshift(draw);
  }
  // 確保排序
  results.sort((a, b) => new Date(b.date) - new Date(a.date));
  writeResults(results);
  return results;
}

app.get('/api/latest', (req, res) => {
  const results = readResults();
  res.json(results[0] || null);
});

app.get('/api/history', (req, res) => {
  const results = readResults();
  const limit = req.query.limit ? Number(req.query.limit) : 0; // 0 為全部
  if (limit > 0) {
      res.json(results.slice(0, limit));
  } else {
      res.json(results);
  }
});

// --- Auth Routes ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password, code } = req.body;
        if (!username || !password || !code) return res.status(400).json({ ok: false, error: '缺少必要欄位' });
        
        const result = await AuthService.register(username, password, code);
        res.json({ ok: true, data: result });
    } catch (e) {
        res.status(400).json({ ok: false, error: e.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await AuthService.login(username, password);
        res.json({ ok: true, data: result });
    } catch (e) {
        res.status(401).json({ ok: false, error: e.message });
    }
});

// --- Analysis Routes (Protected) ---
app.get('/api/stats', AuthService.authenticateToken, (req, res) => {
    const results = readResults();
    const window = req.query.window ? Number(req.query.window) : 100;
    const stats = AnalysisService.getFrequencyStats(results, window);
    res.json(stats);
});

app.get('/api/analysis/trend', AuthService.authenticateToken, (req, res) => {
    const results = readResults();
    const limit = req.query.limit ? Number(req.query.limit) : 30;
    const data = AnalysisService.getTrendData(results, limit);
    res.json({ ok: true, data });
});

app.get('/api/analysis/drag', AuthService.authenticateToken, (req, res) => {
    const target = Number(req.query.number);
    if (!target || target < 1 || target > 39) return res.status(400).json({ ok: false, error: '無效號碼' });
    
    const results = readResults();
    const stats = AnalysisService.getDragStats(results, target);
    res.json({ ok: true, data: stats });
});

app.get('/api/analysis/consecutive', AuthService.authenticateToken, (req, res) => {
    const results = readResults();
    const stats = AnalysisService.getConsecutiveStats(results);
    res.json({ ok: true, data: stats });
});

app.get('/api/analysis/calc', AuthService.authenticateToken, (req, res) => {
    // 雖然計算可以在前端做，但提供 API 保持邏輯統一
    // 這裡只是範例，碰數通常純前端即可
    const n = Number(req.query.n);
    const k = Number(req.query.k);
    const count = AnalysisService.calculateCombinations(n, k);
    res.json({ ok: true, count });
});

// --- Admin Routes ---
app.post('/api/admin/generate-codes', AuthService.authenticateToken, AuthService.requireAdmin, (req, res) => {
    const count = req.body.count || 5;
    const codes = AuthService.generateCodes(count);
    res.json({ ok: true, codes: codes.map(c => c.code) });
});

app.get('/api/admin/codes', AuthService.authenticateToken, AuthService.requireAdmin, (req, res) => {
     const codes = AuthService.getUnusedCodes();
     res.json({ ok: true, codes });
});

app.post('/api/correct', (req, res) => {
  const { date, numbers } = req.body;
  if (!date || !Array.isArray(numbers) || numbers.length !== 5) {
    return res.status(400).json({ ok: false, error: '格式錯誤' });
  }
  // 驗證
  const valid = numbers.every(n => Number.isInteger(n) && n >= 1 && n <= 39);
  if (!valid) return res.status(400).json({ ok: false, error: '號碼必須是 1-39' });
  
  try {
    const sortedNums = numbers.sort((a, b) => a - b);
    const results = readResults();
    const idx = results.findIndex(r => r.date === date);
    const newItem = {
        date,
        numbers: sortedNums,
        rawDate: idx >= 0 ? results[idx].rawDate : date,
        source: 'manual-fix',
        updatedAt: new Date().toISOString()
    };
    
    upsertDraw(newItem);
    const msg = `${date} 更新為 ${sortedNums.join(',')}`;
    console.log(`[Manual Fix] ${msg}`);
    writeLog('MANUAL_FIX', msg);
    res.json({ ok: true, data: newItem });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/refresh', async (req, res) => {
  try {
    const draw = await fetchLatest539();
    if (!draw || !Array.isArray(draw.numbers) || draw.numbers.length !== 5) {
      return res.status(502).json({ ok: false, error: '來源資料解析失敗' });
    }
    const results = upsertDraw(draw);
    res.json({ ok: true, latest: results[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/refresh-history', async (req, res) => {
    try {
        console.log('[History] 開始全量更新...');
        const list = await fetchHistory539();
        let count = 0;
        const results = readResults();
        
        // 批量更新
        list.forEach(item => {
            const idx = results.findIndex(r => r.date === item.date);
            if (idx === -1) {
                results.push(item);
                count++;
            } else {
                // 如果來源是 manual-fix，則不覆蓋，除非強制 (這裡簡單起見：不覆蓋手動修正)
                if (results[idx].source !== 'manual-fix') {
                     // 檢查是否有變動
                     if (JSON.stringify(results[idx].numbers) !== JSON.stringify(item.numbers)) {
                         results[idx] = item;
                         count++;
                     }
                }
            }
        });
        
        results.sort((a, b) => new Date(b.date) - new Date(a.date));
        writeResults(results);
        const msg = `更新完成，變更/新增 ${count} 筆`;
        console.log(`[History] ${msg}`);
        writeLog('HISTORY_SYNC', msg);
        res.json({ ok: true, updatedCount: count });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

async function initialFetch() {
  try {
    const latest = readResults()[0];
    const fetched = await fetchLatest539();
    if (!latest || latest.date !== fetched.date) {
      upsertDraw(fetched);
      console.log('[539] 初始抓取完成:', fetched.date, fetched.numbers.join(','));
    } else {
      console.log('[539] 已是最新期:', latest.date);
    }
  } catch (e) {
    console.warn('[539] 初始抓取失敗:', e.message);
  }
}

cron.schedule('40 20 * * 1-6', async () => {
  try {
    const fetched = await fetchLatest539();
    upsertDraw(fetched);
    const msg = `自動抓取完成: ${fetched.date} ${fetched.numbers.join(',')}`;
    console.log(`[539] ${msg}`);
    writeLog('AUTO_FETCH', msg);
  } catch (e) {
    const msg = `自動抓取失敗: ${e.message}`;
    console.warn(`[539] ${msg}`);
    writeLog('AUTO_FETCH_ERROR', msg);
  }
}, { timezone: 'Asia/Taipei' });

app.listen(PORT, async () => {
  console.log(`Server running at http://localhost:${PORT}`);
  await initialFetch();
});
