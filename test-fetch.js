const { fetchHistory539 } = require('./src/services/fetch539');

(async () => {
  try {
    console.log('開始抓取...');
    const data = await fetchHistory539();
    console.log(`抓取到 ${data.length} 筆資料`);
    if (data.length > 0) {
        console.log('第一筆:', data[0]);
    }
  } catch (e) {
    console.error('錯誤:', e);
  }
})();
