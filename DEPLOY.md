# 部署指南 (Deployment Guide)

本指南將引導您將 539 分析平台部署至公開網路環境。

## ☁️ 部署選項

### 選項 A: 使用 Docker (推薦)

本專案已包含 `Dockerfile`，可部署至任何支援 Docker 的平台 (Render, Railway, AWS ECS, DigitalOcean)。

1.  **建置映像檔**
    ```bash
    docker build -t 539-analysis .
    ```

2.  **執行容器**
    ```bash
    docker run -d -p 80:3000 \
      -e JWT_SECRET=your-production-secret \
      -e NODE_ENV=production \
      -v $(pwd)/data:/app/data \
      --name 539-app \
      539-analysis
    ```
    *   **注意**: `-v` 參數非常重要！因為本系統使用檔案資料庫，若未掛載 Volume，重啟容器後資料會遺失。

### 選項 B: 一般 VPS (Ubuntu/CentOS)

1.  安裝 Node.js 18+ 與 PM2:
    ```bash
    npm install -g pm2
    ```
2.  上傳程式碼並安裝依賴:
    ```bash
    npm ci --only=production
    ```
3.  設定環境變數 (`.env`)。
4.  使用 PM2 啟動:
    ```bash
    pm2 start ecosystem.config.js --env production
    ```

## 🔒 安全性配置

在生產環境中，請務必遵循以下規範：

1.  **環境變數**:
    *   `JWT_SECRET`: 設定為長且複雜的隨機字串。
    *   `NODE_ENV`: 設為 `production` 以啟用效能優化與錯誤訊息隱藏。

2.  **HTTPS (SSL)**:
    *   建議在應用程式前方設置 Nginx 反向代理或使用 Cloudflare 來處理 SSL 加密。
    *   若使用 PaaS (Render/Heroku)，平台通常會自動處理 HTTPS。

3.  **防火牆**:
    *   僅開放必要端口 (如 80/443)，應用程式端口 (3000) 不應直接暴露。

## 📊 監控與維護

*   **日誌 (Logs)**: 
    *   應用程式日誌位於 `data/logs/`。
    *   使用 PM2 可透過 `pm2 logs` 查看即時日誌。
*   **備份**:
    *   定期備份 `data/` 目錄下的所有 JSON 檔案。
    *   `data/backup/` 目錄會自動儲存每次寫入前的備份。

## 🔄 CI/CD 自動化

本專案包含 GitHub Actions 範本 (`.github/workflows/deploy.yml`)。
若要啟用自動部署：
1.  Fork 本專案。
2.  在 GitHub Repository Settings > Secrets 加入 `DOCKER_USERNAME` 與 `DOCKER_PASSWORD`。
3.  推送代碼至 `main` 分支即可觸發自動建置。
