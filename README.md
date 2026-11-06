# Wave Studio — GitHub Pages 版

純 HTML / CSS / JavaScript 音訊編輯器。沒有後端、API Key、npm 安裝或建置步驟，也不依賴 ChatGPT 登入。音訊在瀏覽器本機處理。

## 最簡單部署：從分支發布

1. 在 GitHub 建立 Repository，例如 `wave-studio`。
2. 解壓縮此 ZIP，將 **index.html** 上傳至 Repository 的最外層，不要只上傳 ZIP，也不要多包一層資料夾。
3. 提交到 `main` 分支。
4. 開啟 **Settings → Pages**。
5. Source 選 **Deploy from a branch**；Branch 選 **main**，資料夾選 **/(root)**，按 Save。
6. 等待 Pages 完成發布，從 Pages 設定頁開啟實際網址。一般專案網址格式為 `https://你的帳號.github.io/wave-studio/`。

此方式只需 index.html；不必上傳 .github 資料夾。

## 自動部署：GitHub Actions

若你使用 Git 上傳完整專案（包含 `.github/workflows/deploy.yml`）：

1. 上傳此資料夾內所有檔案到 Repository 根目錄，提交到 main。
2. **Settings → Pages → Source** 選 **GitHub Actions**。
3. 前往 **Actions → Deploy Wave Studio to GitHub Pages → Run workflow** 執行第一次部署。
4. 後續每次推送 main，會自動更新網頁。

不要同時混用兩種發布來源。若預設分支不是 main，請將 deploy.yml 的 branches 改為你的分支名稱。

## 功能

- 波形檢視、時間選區、縮放、播放與循環
- 剪下／複製／貼上、刪除、保留選區、復原／重做
- 麥克風錄音、串接音訊、50% 混音、插入靜音
- 增益、標準化、壓縮、淡入淡出、反向、迴音、混響
- 低通／高通／帶通及低音、高音增強，噪音門、簡易點擊抑制
- 中央人聲降低（左右聲道相減，非 AI 分軌）
- FFT 即時頻譜、峰值／RMS 電平、時間標記
- WAV PCM 16／24／32-bit 匯出，JSON 專案儲存／載入

## 使用與限制

- 建議使用桌面 Chrome 或 Edge；先按「載入示範音訊」測試。
- 麥克風需要 HTTPS 與使用者允許權限；GitHub Pages 提供 HTTPS。
- 檔案格式依瀏覽器解碼能力而定，常見 WAV / MP3 較適合。未內建 MP3 編碼器，輸出為 WAV。
- 不提供 VST、DirectX、AI 分軌、批次處理及所有 WavePad 格式。
- 速度處理會連帶改變音高。效果採簡化 DSP，並非 WavePad 演算法。
- 專案存檔為 32-bit 整數 PCM；超過 ±1 的訊號會裁切，請先檢查峰值。
- 大檔案與最多 15 次編輯歷程可能使用大量記憶體。切換左側音訊會清除該次編輯的復原歷程與標記，請先存專案。
- 網站本身不含音訊上傳功能；GitHub Pages 網站的存取權限由 GitHub 設定決定。
- 這是獨立製作的 Wave Studio，非 NCH / WavePad 官方產品。

## 參考

GitHub 官方發布來源說明：https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
