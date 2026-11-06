# Wave Studio — 純網頁 AI 與播放音量版

HTML、CSS、JavaScript 分開儲存；直接部署 GitHub Pages，不需要 Colab、Python 後端、API Key 或 ChatGPT 登入。

## GitHub Pages 部署

解壓縮後，將全部檔案與 vendor 資料夾一起上傳到 Repository 根目錄，保留目錄結構。不要只上傳 index.html。

簡單方式：Settings → Pages → Deploy from a branch → main → /(root) → Save。

GitHub Actions 方式：包含 .github/workflows/deploy.yml 的所有檔案推送到 main，Pages 的 Source 選 GitHub Actions，第一次可手動 Run workflow。

不能直接以 file:// 雙擊啟動 AI；請使用 GitHub Pages HTTPS 或 localhost 網頁伺服器。

## 播放音量

- Master：總音量 0–150%。
- 左聲道 L / 右聲道 R：各自 0–150%。
- 播放中即時生效，15 ms 平滑變化，0% 為靜音。
- 重設音量：三組都恢復 100%。
- 單聲道會送到左右輸出，可分別控制。
- 僅作用於主編輯器播放，不改變音訊資料及匯出；AI 結果面板的原生試聽播放器使用自己的音量。
- 實際聲道增益 = Master × 該聲道音量；兩者超過 100% 可能使輸出失真。

## AI 去人聲

使用 Kim_Vocal_2 + web-audio-separation 0.3.1 + ONNX Runtime Web 1.29.0。

1. 匯入歌曲，在波形選取 10 秒左右區域。
2. 按「分離伴奏與人聲」。未選取範圍時使用整檔，每次最多 60 秒。
3. 首次會從 Hugging Face 下載約 67 MB 模型，成功後嘗試存入瀏覽器快取。
4. 結果可試聽、下載 WAV，或載入編輯器。

推論完全在瀏覽器本機執行，沒有音訊上傳程式。模型下載需要網路，運算引擎檔案已包含在 vendor；不宣稱完全離線可用。

自動模式優先嘗試 WebGPU，初始化失敗時嘗試 CPU。若 GPU 推論期間失敗，請手動選 CPU 再試。GitHub Pages 無跨來源隔離設定時 CPU 採單執行緒，可能很慢。處理期間請保持分頁開啟；重新整理會中止並清除未儲存內容。

這是實驗性 AI 功能，可能殘留人聲、產生音質損傷或遇到記憶體不足。不要用中央聲道相減功能的結果冒充 AI 結果。此版不支援全曲無限制推論、獨立變速不變調、VST、DirectX。

## 驗證範圍

- JavaScript 語法檢查通過。
- 瀏覽器實測 CPU/WASM：2 秒合成示範音訊完成分離，產生伴奏與人聲。
- Master / L / R 各滑桿與重設已驗證。
- 尚未在此環境驗證 GPU 推論、長曲穩定性或真人歌曲分離品質。

## 主要檔案

- index.html：頁面
- style.css：樣式
- app.js：編輯與主播放器
- ai.js：AI 面板與流程，可自行修改
- ai-engine.js：預先打包的 AI 推論函式庫
- vendor/：ONNX Runtime Web 的 WASM 運算檔與授權
- .github/workflows/deploy.yml：選用自動部署

## 開源來源與授權

- web-audio-separation（MIT）：https://github.com/incidentist/web-audio-separation
- ONNX Runtime（MIT）：https://github.com/microsoft/onnxruntime
- 內含 pffft WASM FFT，原始檔中保留上游產物及標記；參考分離引擎原始專案。
- Kim_Vocal_2 模型由瀏覽器向上游鏡像下載，ZIP 未包含權重。模型使用與再散布條件須依權重提供者說明確認： https://huggingface.co/Blane187/all_public_uvr_models
- 這是獨立開發的 Wave Studio，非 NCH / WavePad 官方產品。
