# FitBudget Food AI — Gemini + Cloudflare Worker

## 免費額度優先部署

1. 到 https://aistudio.google.com/apikey 建立 Gemini API key，確認專案適用免費額度。不要把金鑰貼到 GitHub 或聊天中。
2. 到 https://dash.cloudflare.com/ 註冊／登入，啟用 Workers 免費方案。
3. 在電腦安裝 Node.js，於本專案根目錄執行：
   ```sh
   cd cloudflare-worker
   npx wrangler login
   npx wrangler secret put GEMINI_API_KEY
   npx wrangler secret put FITBUDGET_ACCESS_TOKEN
   npx wrangler deploy
   ```
   第二個 secret 請自行產生足夠長的隨機字串（例如密碼管理器產生 32 位以上）。
4. Wrangler 會顯示 `https://fitbudget-food-ai.<your-subdomain>.workers.dev`。
5. 在 https://sammipig.github.io/-app/#food 輸入 Worker 網址和第 3 步的存取碼；選擇食物照片並按「使用 AI 辨識照片」。
6. 檢查 AI 回傳的食材、份量和估算熱量，確認後才儲存。

## 注意
- Worker 使用 `gemini-2.5-flash-lite` 及 Google Gemini generateContent REST API。
- 免費額度和可用模型依 Google AI Studio 專案與地區而異；達上限會回傳 HTTP 429，請稍後重試。
- API key 只放在 Cloudflare Worker Secret；前端不得包含 Gemini API key。
- `FITBUDGET_ACCESS_TOKEN` 是共用存取碼，不是完整身分驗證。請勿公開分享；正式公開使用應增加使用者登入、速率限制及預算監控。
- 食物熱量僅供粗估；AI 無法從照片可靠判斷隱藏油脂、調味及精確重量。
- Worker 未在本次操作中部署，亦未執行端到端實測。
