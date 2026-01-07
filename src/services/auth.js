const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const USERS_PATH = path.join(DATA_DIR, 'users.json');
const CODES_PATH = path.join(DATA_DIR, 'codes.json');

// JWT Secret - 在生產環境應使用環境變數
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

function readJson(filePath) {
    try {
        if (!fs.existsSync(filePath)) return [];
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
        return [];
    }
}

function writeJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

const AuthService = {
    async register(username, password, activationCode) {
        const users = readJson(USERS_PATH);
        const codes = readJson(CODES_PATH);

        // 檢查用戶名
        if (users.find(u => u.username === username)) {
            throw new Error('用戶名已存在');
        }

        // 驗證激活碼
        const codeIndex = codes.findIndex(c => c.code === activationCode && !c.isUsed);
        if (codeIndex === -1) {
            throw new Error('無效或已使用的激活碼');
        }

        // 標記激活碼為已使用
        codes[codeIndex].isUsed = true;
        codes[codeIndex].usedBy = username;
        codes[codeIndex].usedAt = new Date().toISOString();
        writeJson(CODES_PATH, codes);

        // 建立用戶
        const passwordHash = await bcrypt.hash(password, 10);
        const newUser = {
            id: Date.now().toString(),
            username,
            passwordHash,
            isPaid: true, // 透過激活碼註冊，預設為已付費
            role: 'user',
            createdAt: new Date().toISOString()
        };
        
        users.push(newUser);
        writeJson(USERS_PATH, users);

        return { id: newUser.id, username: newUser.username, role: newUser.role };
    },

    async login(username, password) {
        const users = readJson(USERS_PATH);
        const user = users.find(u => u.username === username);

        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
            throw new Error('用戶名或密碼錯誤');
        }

        // 產生 Token
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, isPaid: user.isPaid },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        return { token, user: { id: user.id, username: user.username, role: user.role } };
    },

    generateCodes(count = 5) {
        const codes = readJson(CODES_PATH);
        const newCodes = [];
        for (let i = 0; i < count; i++) {
            const code = 'VIP' + Math.random().toString(36).substr(2, 6).toUpperCase();
            newCodes.push({
                code,
                isUsed: false,
                createdAt: new Date().toISOString()
            });
        }
        const updatedCodes = [...codes, ...newCodes];
        writeJson(CODES_PATH, updatedCodes);
        return newCodes;
    },

    getUnusedCodes() {
        const codes = readJson(CODES_PATH);
        return codes.filter(c => !c.isUsed).map(c => c.code);
    },

    // Middleware
    authenticateToken(req, res, next) {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) return res.status(401).json({ ok: false, error: '未登入' });

        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) return res.status(403).json({ ok: false, error: 'Token 無效或過期' });
            
            // 強制檢查是否消費過 (雖然 Token 裡有 isPaid，但為了安全可以再查一次 DB，這裡簡單信任 Token)
            if (!user.isPaid) {
                return res.status(403).json({ ok: false, error: '請先購買服務' });
            }
            
            req.user = user;
            next();
        });
    },

    requireAdmin(req, res, next) {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ ok: false, error: '權限不足' });
        }
        next();
    }
};

module.exports = AuthService;
