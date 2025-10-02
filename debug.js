// --- On-Screen Debug Console Logic with FPS Counter ---
(function () {
  // bodyにクラスを追加してCSSで表示を制御
  document.body.classList.add('debug-mode');

  function logToScreen(message, level = "log") {
    // ... (この部分は変更なし) ...
    const logContainer = document.getElementById("debug-log-container");
    if (!logContainer) return;
    const msgEl = document.createElement("div");
    const timestamp = new Date().toLocaleTimeString();
    const formattedMessage = Array.from(arguments).map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
    ).join(' ');
    msgEl.textContent = `[${timestamp}] ${formattedMessage}`;
    msgEl.className = `log-message log-${level}`;
    logContainer.appendChild(msgEl);
    logContainer.scrollTop = logContainer.scrollHeight;
  }

  // 既存のconsole.logなどを乗っ取る
  if (window.console && console.log) {
    // ... (この部分は変更なし) ...
    const oldLog = console.log;
    console.log = function () {
      logToScreen.apply(null, arguments);
      oldLog.apply(console, arguments);
    };
    const oldWarn = console.warn;
    console.warn = function () {
      logToScreen.apply(null, ["[WARN]", ...arguments]);
      oldWarn.apply(console, arguments);
    };
    const oldError = console.error;
    console.error = function () {
      logToScreen.apply(null, ["[ERROR]", ...arguments]);
      oldError.apply(console, arguments);
    };
  }

  // --- FPS表示機能 ここから追加 ---

  // ステップ1でHTMLに追加した要素を取得
  const fpsDisplay = document.getElementById("debug-stats");

  if (fpsDisplay) {
    let frameCount = 0;
    let lastTime = performance.now();

    const updateFps = () => {
      const now = performance.now();
      frameCount++;

      // 1秒ごとに表示を更新
      if (now >= lastTime + 1000) {
        const fps = frameCount;
        fpsDisplay.textContent = `FPS: ${fps}`;
        frameCount = 0;
        lastTime = now;
      }

      // 次のフレームで再度この関数を呼ぶ
      requestAnimationFrame(updateFps);
    };
    
    // FPS計算を開始
    updateFps();
  }

  // --- FPS表示機能 ここまで ---
  
})();
// --- End of On-Screen Debug Console Logic ---
