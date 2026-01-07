const AnalysisService = {
    // 拖牌分析：給定號碼，找出下期最常開出的號碼
    getDragStats(history, targetNum, limit = 500) {
        const stats = Array(40).fill(0); // Index 1-39
        let count = 0;
        
        // 從最新的資料開始往回看
        // 注意 history[0] 是最新
        for (let i = 1; i < Math.min(history.length, limit); i++) {
            const prevDraw = history[i]; // 上一期
            const nextDraw = history[i-1]; // 下一期 (相對於 prevDraw)
            
            if (prevDraw.numbers.includes(targetNum)) {
                nextDraw.numbers.forEach(n => {
                    if (n >= 1 && n <= 39) stats[n]++;
                });
                count++;
            }
        }
        
        const result = stats
            .map((count, num) => ({ number: num, count }))
            .filter(x => x.number > 0)
            .sort((a, b) => b.count - a.count); // 按出現次數降序
            
        return { target: targetNum, occurrences: count, nextStats: result };
    },

    // 碰數計算
    calculateCombinations(n, k) {
        if (k < 0 || k > n) return 0;
        if (k === 0 || k === n) return 1;
        if (k > n / 2) k = n - k;
        
        let res = 1;
        for (let i = 1; i <= k; i++) {
            res = res * (n - i + 1) / i;
        }
        return Math.round(res);
    },

    // 走勢圖數據 (將數據轉換為適合前端繪圖的格式)
    getTrendData(history, limit = 30) {
        const data = history.slice(0, limit).reverse(); // 轉為時間正序
        return data.map(d => ({
            date: d.date,
            numbers: d.numbers
        }));
    },

    // 號碼頻率統計 (Hot/Cold)
    getFrequencyStats(history, limit = 100) {
        const stats = Array(40).fill(0);
        const analyzed = Math.min(history.length, limit);
        
        for(let i=0; i<analyzed; i++) {
            history[i].numbers.forEach(n => {
                if(n >= 1 && n <= 39) stats[n]++;
            });
        }
        
        const result = stats.map((count, num) => ({ number: num, count }))
            .filter(x => x.number > 0)
            .sort((a, b) => b.count - a.count); // 雖然前端可能按號碼排，但這裡先回傳
            
        // 前端 loadStats 是按號碼順序渲染 1-39，所以這裡回傳原始陣列比較好？
        // loadStats: els.statsGrid.innerHTML = data.stats.map...
        // 為了配合前端 map，我們應該回傳 1-39 的陣列，按號碼排序
        
        const sortedByNum = stats.map((count, num) => ({ number: num, count }))
            .filter(x => x.number > 0);
            
        return {
            window: analyzed,
            stats: sortedByNum
        };
    },
    
    // 連莊分析 (上期號碼在下期重複出現的統計)
    getConsecutiveStats(history, limit = 100) {
        let totalRepeat = 0;
        const repeatCounts = Array(6).fill(0); // 0~5個連莊
        
        for (let i = 0; i < Math.min(history.length - 1, limit); i++) {
            const current = new Set(history[i].numbers);
            const prev = history[i+1].numbers;
            
            let hits = 0;
            prev.forEach(n => {
                if (current.has(n)) hits++;
            });
            
            repeatCounts[hits]++;
            if (hits > 0) totalRepeat++;
        }
        
        return {
            analyzed: Math.min(history.length - 1, limit),
            repeatCounts: repeatCounts.map((count, hits) => ({ hits, count })),
            probability: totalRepeat / Math.min(history.length - 1, limit)
        };
    }
};

module.exports = AnalysisService;
