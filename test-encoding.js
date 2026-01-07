const axios = require('axios');
const iconv = require('iconv-lite');

(async () => {
  try {
    const url = 'https://www.pilio.idv.tw/lto539/list.asp';
    const { data: buffer } = await axios.get(url, { responseType: 'arraybuffer' });
    
    console.log('Buffer length:', buffer.length);
    // 找一下 "01/06" 的位置
    const str = buffer.toString('binary'); // 暫時用 binary 找
    const idx = str.indexOf('01/06');
    if (idx !== -1) {
        console.log('Found 01/06 at', idx);
        // 印出附近的 hex
        const slice = buffer.slice(idx, idx + 20);
        console.log('Hex:', slice.toString('hex'));
        
        // 嘗試 Big5 解碼
        console.log('Big5:', iconv.decode(slice, 'big5'));
        // 嘗試 UTF-8 解碼
        console.log('UTF-8:', slice.toString('utf8'));
    } else {
        console.log('Not found 01/06');
    }

  } catch (e) {
    console.error(e);
  }
})();
