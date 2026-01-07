const fs = require('fs');
const path = require('path');
const { fetchHistory539 } = require('../services/fetch539');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const RESULTS_PATH = path.join(DATA_DIR, 'results.json');

(async () => {
  try {
    console.log('開始全量修復數據...');
    
    // 1. 抓取最新正確數據
    const newData = await fetchHistory539();
    console.log(`抓取到 ${newData.length} 筆正確數據`);

    // 2. 讀取現有數據
    let currentData = [];
    if (fs.existsSync(RESULTS_PATH)) {
        currentData = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf-8'));
    }
    console.log(`現有數據 ${currentData.length} 筆`);

    // 3. 合併與修復
    // 策略：以新數據為主，覆蓋舊數據（除了 manual-fix）
    // 但因為舊數據有亂碼，我們其實希望用新數據的 rawDate 覆蓋舊的
    // 即使是 manual-fix，如果 rawDate 是亂碼，也應該修復 rawDate
    
    let updateCount = 0;
    
    newData.forEach(newItem => {
        const idx = currentData.findIndex(d => d.date === newItem.date);
        
        if (idx === -1) {
            // 新增
            currentData.push(newItem);
            updateCount++;
        } else {
            // 已存在，檢查是否需要更新
            const oldItem = currentData[idx];
            
            // 如果是手動修正的數據，保留 numbers，但修復 rawDate (如果亂碼)
            if (oldItem.source === 'manual-fix') {
                // 檢查 rawDate 是否有亂碼特徵 (包含非 ASCII 且看起來不像中文日期的，簡單判斷是否包含  或 鈭 等)
                // 其實直接用新的 rawDate 覆蓋舊的 rawDate 通常是安全的，因為 manual-fix 主要改 numbers
                if (oldItem.rawDate !== newItem.rawDate) {
                    console.log(`修復 ${oldItem.date} rawDate: ${oldItem.rawDate} -> ${newItem.rawDate}`);
                    oldItem.rawDate = newItem.rawDate;
                    updateCount++;
                }
            } else {
                // 自動抓取的數據，直接完全覆蓋 (修復 numbers 和 rawDate)
                // 檢查是否有變動
                if (JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
                     // 這裡直接賦值會替換整個物件
                     currentData[idx] = newItem;
                     updateCount++;
                }
            }
        }
    });

    // 4. 排序並寫回
    currentData.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // 備份
    const backupPath = path.join(DATA_DIR, 'backup', `results-fix-${Date.now()}.json`);
    if (fs.existsSync(RESULTS_PATH)) {
        fs.copyFileSync(RESULTS_PATH, backupPath);
    }
    
    fs.writeFileSync(RESULTS_PATH, JSON.stringify(currentData, null, 2), 'utf-8');
    
    console.log(`修復完成，更新/新增了 ${updateCount} 筆數據`);
    console.log('數據已寫入 results.json');

  } catch (e) {
    console.error('修復失敗:', e);
  }
})();
