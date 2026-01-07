const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const USERS_PATH = path.join(DATA_DIR, 'users.json');
const CODES_PATH = path.join(DATA_DIR, 'codes.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

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

async function initAuth() {
    console.log('正在初始化認證資料...');

    // 1. 初始化 Admin 用戶
    const users = readJson(USERS_PATH);
    const adminUser = users.find(u => u.role === 'admin');

    if (!adminUser) {
        console.log('找不到管理員，正在建立預設管理員...');
        const passwordHash = await bcrypt.hash('admin123', 10);
        const newAdmin = {
            id: 'admin-' + Date.now(),
            username: 'admin',
            passwordHash,
            isPaid: true,
            role: 'admin',
            createdAt: new Date().toISOString()
        };
        users.push(newAdmin);
        writeJson(USERS_PATH, users);
        console.log('管理員建立成功: admin / admin123');
    } else {
        console.log('管理員已存在。');
    }

    // 2. 初始化激活碼
    const codes = readJson(CODES_PATH);
    const unusedCodes = codes.filter(c => !c.isUsed);

    if (unusedCodes.length === 0) {
        console.log('沒有可用的激活碼，正在生成...');
        const newCodes = [];
        for (let i = 0; i < 5; i++) {
            const code = 'VIP' + Math.random().toString(36).substr(2, 6).toUpperCase();
            newCodes.push({
                code,
                isUsed: false,
                createdAt: new Date().toISOString()
            });
            console.log(`生成激活碼: ${code}`);
        }
        const updatedCodes = [...codes, ...newCodes];
        writeJson(CODES_PATH, updatedCodes);
    } else {
        console.log(`目前已有 ${unusedCodes.length} 個可用激活碼。`);
        console.log('可用激活碼:', unusedCodes.map(c => c.code).join(', '));
    }

    console.log('初始化完成。');
}

initAuth().catch(console.error);
