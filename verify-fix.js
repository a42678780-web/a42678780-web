const { fetchHistory539 } = require('./src/services/fetch539');

(async () => {
  try {
    console.log('正在測試抓取...');
    const data = await fetchHistory539();
    console.log(`抓取到 ${data.length} 筆資料`);
    
    // 檢查前幾筆資料的 rawDate 是否包含亂碼特徵
    // 常見亂碼特徵:  (U+FFFD), 鈭 (Big5誤讀), etc.
    // 這裡我們直接印出來人工確認
    
    const sample = data.slice(0, 5);
    sample.forEach((item, idx) => {
        console.log(`[${idx}] Date: ${item.date}, Raw: ${item.rawDate}`);
    });

  } catch (e) {
    console.error('錯誤:', e);
  }
})();
