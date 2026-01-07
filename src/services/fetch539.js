const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');

// 輔助：轉為數字並驗證範圍
function toNumbers(arr) {
  return arr
    .map(s => parseInt(s, 10))
    .filter(n => Number.isFinite(n) && n >= 1 && n <= 39) // 嚴格過濾 539 範圍
    .slice(0, 5) // 只取前5個
    .sort((a, b) => a - b);
}

// 輔助：解析日期 (支援 "01/06", "2026/01/06" 等)
function parseDate(dateStr, yearSuffix) {
  // 嘗試匹配完整日期 YYYY/MM/DD
  const fullMatch = dateStr.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
  if (fullMatch) return `${fullMatch[1]}/${fullMatch[2]}/${fullMatch[3]}`;

  // 嘗試匹配 MM/DD
  const shortMatch = dateStr.match(/(\d{2})[\/\-](\d{2})/);
  if (shortMatch) {
    const month = shortMatch[1];
    const day = shortMatch[2];
    // 如果有提供年份後綴 (如 "26")
    let year = new Date().getFullYear();
    if (yearSuffix) {
      year = 2000 + parseInt(yearSuffix, 10);
    }
    return `${year}/${month}/${day}`;
  }
  return null;
}

// 來源 1: Pilio 列表 (結構化較好，適合抓歷史與最新)
async function fetchFromPilioList() {
  const url = 'https://www.pilio.idv.tw/lto539/list.asp';
  const { data: buffer } = await axios.get(url, { 
      timeout: 15000, 
      responseType: 'arraybuffer' 
  });
  
  // 檢測編碼：雖然網站標示 Big5，但實測內容為 UTF-8
  // 這裡優先嘗試 UTF-8，若需要兼容可改回 Big5 或自動檢測
  let html = iconv.decode(buffer, 'utf-8');
  
  // 簡單驗證：如果 UTF-8 解碼後包含亂碼特徵（如 ），可能需要切換
  // 但目前測試結果確認為 UTF-8
  
  const $ = cheerio.load(html);
  const results = [];

  $('table tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (tds.length >= 2) {
      // 格式範例: "01/06 26(二)" 或 "01/06<br>26(二)"
      // 先取 HTML 以處理 <br>
      let dateHtml = $(tds[0]).html() || '';
      // 將 <br> 替換為空格
      let dateText = dateHtml.replace(/<br\s*\/?>/gi, ' ');
      // 移除其他 HTML 標籤
      dateText = dateText.replace(/<[^>]+>/g, '');
      
      // 清理空格
      let dateRaw = dateText.replace(/\s+/g, ' ').trim();
      let numsRaw = $(tds[1]).text().trim();
      
      // 如果 dateRaw 包含奇怪的字元，嘗試清理
      // 例如有些時候會有 "01/06 26(二 )"
      
      // 解析日期與年份後綴
      // 匹配 "01/06" 和 "26"
      const dateMatch = dateRaw.match(/(\d{2}\/\d{2})\s*(\d{2})?/);
      if (dateMatch) {
        const datePart = dateMatch[1];
        const yearSuffix = dateMatch[2]; // 可能為 undefined
        
        const date = parseDate(datePart, yearSuffix);
        const matches = numsRaw.match(/\d{2}/g);
        
        if (date && matches) {
          const numbers = toNumbers(Array.from(new Set(matches)));
          if (numbers.length === 5) {
            results.push({
              date,
              rawDate: dateRaw, // 保留用戶要求的原始格式
              numbers,
              source: 'pilio'
            });
          }
        }
      }
    }
  });

  if (results.length > 0) {
    // 按日期降序
    results.sort((a, b) => new Date(b.date) - new Date(a.date));
    return results; // 返回列表
  }
  throw new Error('Pilio列表解析失敗');
}

// 來源 2: 台灣彩券官網 (通常最準，但需動態抓取或解析 API，這裡模擬 HTML 解析)
// 備用來源: Auzonet
async function fetchFromAuzonet() {
  const url = 'https://lotto.auzonet.com/daily539';
  const { data: html } = await axios.get(url, { timeout: 15000 });
  const $ = cheerio.load(html);
  
  // 尋找特定結構
  // Auzonet 通常有 "2026-01-06" 這樣的日期
  let latest = null;
  
  // 嘗試尋找最新的開獎區塊
  // 假設結構中有 .periods-date 或類似
  // 這裡使用寬泛搜索但嚴格驗證
  
  const results = [];
  
  // 模擬遍歷邏輯，尋找日期與號碼緊鄰的結構
  // 簡化：只抓最新一期
  let foundDate = null;
  let foundNums = [];

  $('body *').each((_, el) => {
    const t = $(el).text().trim();
    // 匹配 YYYY-MM-DD
    const dateM = t.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
    if (dateM && !foundDate) {
      foundDate = `${dateM[1]}/${dateM[2]}/${dateM[3]}`;
    }
    
    // 如果找到日期，接著找號碼
    if (foundDate && foundNums.length < 5) {
        // 尋找連續的號碼
        const numsM = t.match(/\b([0-3]\d)\b/g);
        if (numsM) {
            numsM.forEach(n => {
                const val = parseInt(n, 10);
                if (val >= 1 && val <= 39 && !foundNums.includes(val)) {
                    foundNums.push(val);
                }
            });
        }
    }
  });
  
  if (foundDate && foundNums.length >= 5) {
      const numbers = toNumbers(foundNums);
      if (numbers.length === 5) {
          return [{
              date: foundDate,
              numbers,
              source: 'auzonet'
          }];
      }
  }
  
  throw new Error('Auzonet 解析失敗');
}

// 統一入口：抓取最新
async function fetchLatest539() {
  const errors = [];
  
  // 優先嘗試 Pilio，因為它有列表且格式符合用戶描述
  try {
    const list = await fetchFromPilioList();
    if (list && list.length > 0) {
      return list[0]; // 返回最新一期
    }
  } catch (e) {
    errors.push(`Pilio: ${e.message}`);
  }

  // 備用
  try {
    const list = await fetchFromAuzonet();
    if (list && list.length > 0) {
      return list[0];
    }
  } catch (e) {
    errors.push(`Auzonet: ${e.message}`);
  }

  throw new Error(`所有來源抓取失敗: ${errors.join(' | ')}`);
}

// 新增：抓取歷史 (回傳完整列表)
async function fetchHistory539() {
   try {
    const list = await fetchFromPilioList();
    return list;
  } catch (e) {
    console.error('抓取歷史失敗:', e);
    return [];
  }
}

module.exports = { fetchLatest539, fetchHistory539 };
