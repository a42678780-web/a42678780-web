const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';
let adminToken = '';
let userToken = '';
let activationCode = '';

async function testAuth() {
    try {
        console.log('1. 測試 Admin 登入...');
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });
        if (loginRes.data.ok) {
            adminToken = loginRes.data.data.token;
            console.log('Admin 登入成功。');
        } else {
            throw new Error('Admin 登入失敗');
        }

        console.log('2. 測試 Admin 獲取代碼...');
        const codesRes = await axios.get(`${BASE_URL}/admin/codes`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        if (codesRes.data.ok && codesRes.data.codes.length > 0) {
            activationCode = codesRes.data.codes[0];
            console.log('獲取代碼:', activationCode);
        } else {
            // 如果沒代碼，生成一個
            console.log('無可用代碼，生成中...');
            const genRes = await axios.post(`${BASE_URL}/admin/generate-codes`, { count: 1 }, {
                headers: { Authorization: `Bearer ${adminToken}` }
            });
            activationCode = genRes.data.codes[0];
            console.log('生成代碼:', activationCode);
        }

        console.log(`3. 測試註冊 (使用代碼 ${activationCode})...`);
        const testUser = 'user' + Date.now();
        await axios.post(`${BASE_URL}/auth/register`, {
            username: testUser,
            password: 'password123',
            code: activationCode
        });
        console.log('註冊成功。');

        console.log('4. 測試一般用戶登入...');
        const userLoginRes = await axios.post(`${BASE_URL}/auth/login`, {
            username: testUser,
            password: 'password123'
        });
        userToken = userLoginRes.data.data.token;
        console.log('用戶登入成功。');

        console.log('5. 測試存取受保護資源 (Trend)...');
        const trendRes = await axios.get(`${BASE_URL}/analysis/trend`, {
            headers: { Authorization: `Bearer ${userToken}` }
        });
        // getTrendData 回傳的是陣列: [{date, numbers}, ...]
        if (trendRes.data.data && Array.isArray(trendRes.data.data)) {
            console.log('Trend API 成功。數據筆數:', trendRes.data.data.length);
        } else {
            console.error('Trend API 格式錯誤:', trendRes.data);
        }

        console.log('6. 測試存取受保護資源 (Stats)...');
        const statsRes = await axios.get(`${BASE_URL}/stats`, {
            headers: { Authorization: `Bearer ${userToken}` }
        });
        if (statsRes.data && Array.isArray(statsRes.data.stats)) {
            console.log('Stats API 成功。統計號碼數:', statsRes.data.stats.length);
        } else {
            console.error('Stats API 格式錯誤:', statsRes.data);
        }

        console.log('所有測試通過！');

    } catch (e) {
        console.error('測試失敗:', e.response?.data || e.message);
        process.exit(1);
    }
}

setTimeout(testAuth, 1000);
