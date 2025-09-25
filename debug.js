// --- On-Screen Debug Console Logic ---
(function () {
  // bodyにクラスを追加してCSSで表示を制御
  document.body.classList.add('debug-mode');

  function logToScreen(message, level = "log") {
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
})();
// --- End of On-Screen Debug Console Logic ---