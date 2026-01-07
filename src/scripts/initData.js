const fs = require('fs');
const path = require('path');
const { fetchHistory539 } = require('../services/fetch539');

const DATA_FILE = path.join(__dirname, '../../data/results.json');

async function initData() {
  console.log('開始初始化歷史數據...');
  try {
    const history = await fetchHistory539();
    console.log(`成功抓取 ${history.length} 筆歷史數據`);

    // 讀取現有數據 (如果有的話)
    let existing = [];
    if (fs.existsSync(DATA_FILE)) {
      try {
        existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      } catch (e) {
        console.warn('現有數據損毀，將覆蓋');
      }
    }

    // 合併數據 (以日期為 key 去重)
    const map = new Map();
    // 先放舊的
    existing.forEach(item => map.set(item.date, item));
    // 再放新的 (覆蓋舊的，因為新抓取的可能修正了錯誤)
    history.forEach(item => map.set(item.date, item));

    const finalData = Array.from(map.values())
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    fs.writeFileSync(DATA_FILE, JSON.stringify(finalData, null, 2));
    console.log('數據寫入完成:', DATA_FILE);
  } catch (error) {
    console.error('初始化失敗:', error);
  }
}

if (require.main === module) {
  initData();
}

module.exports = { initData };
