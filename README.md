# 539 專業分析平台 (Lottery Analysis Platform)

這是一個基於 Node.js 開發的 539 樂透數據分析平台，提供即時開獎資訊、歷史數據統計、走勢分析及大數據拖牌預測功能。

## 🚀 主要功能

*   **即時開獎**：自動同步最新開獎號碼。
*   **數據統計**：冷熱門號碼分析 (Bar Chart)。
*   **走勢分析**：連莊機率與趨勢預測。
*   **拖牌大數據**：分析特定號碼開出後的下一期規律。
*   **碰數試算**：二三四星組合數計算器。
*   **會員系統**：JWT 認證、激活碼註冊機制 (付費牆)。
*   **管理後台**：激活碼生成、數據修正。

## 🛠 技術架構

*   **Frontend**: HTML5, CSS3 (Responsive), Vanilla JS
*   **Backend**: Node.js, Express
*   **Data**: File-based JSON storage (NoSQL-like)
*   **Auth**: JWT (JSON Web Tokens)
*   **Security**: Helmet, Rate Limiting, BCrypt

## 🏁 快速開始

### 1. 安裝依賴

```bash
npm install
```

### 2. 環境設定

複製 `.env.example` (若無則參考下方) 並建立 `.env`:

```env
PORT=3000
JWT_SECRET=your-secure-secret
DATA_DIR=./data
NODE_ENV=development
```

### 3. 初始化資料

第一次執行前，請執行初始化腳本以建立管理員帳號：

```bash
node src/scripts/initAuth.js
```
*   預設管理員: `admin` / `admin123`

### 4. 啟動伺服器

```bash
# 開發模式
npm run dev

# 生產模式
npm start
```

訪問 `http://localhost:3000` 即可使用。

## 📂 專案結構

*   `public/`: 前端靜態檔案
*   `src/server.js`: 後端入口
*   `src/services/`: 業務邏輯 (Auth, Analysis, Fetch)
*   `data/`: 資料儲存區 (需持久化)

## 📜 授權

MIT License
