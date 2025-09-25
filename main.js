// ★★★ inputオブジェクトを更新 ★★★
const input = {
  joystick: {
    active: false,
    pointerId: null, // id を pointerId に変更
    x: 0,
    y: 0,
  },
  view: { // touch を view に変更
    active: false,
    pointerId: null, // id を pointerId に変更
    startX: 0,
    startY: 0,
  },
  verticalMove: 0,
};


// ★★★ setupEventListeners を丸ごと置き換え ★★★
function setupEventListeners() {
  window.addEventListener("resize", onWindowResize);
  window.addEventListener("orientationchange", checkScreenOrientation);

  // --- ポインターイベントに一本化 ---
  window.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);

  ui.gyroButton.addEventListener("pointerdown", () => {
    controls.connect();
    ui.gyroButton.style.display = "none";
  });

  ui.settingsButton.addEventListener("pointerdown", () =>
    ui.modalOverlay.classList.remove("hidden")
  );
  ui.closeModalButton.addEventListener("pointerdown", () =>
    ui.modalOverlay.classList.add("hidden")
  );
  ui.modalOverlay.addEventListener("pointerdown", (e) => {
    if (e.target === ui.modalOverlay) {
      ui.modalOverlay.classList.add("hidden");
    }
  });

  ui.resetViewButton.addEventListener("pointerdown", () => {
    if (controls) {
      controls.resetView();
    }
    ui.modalOverlay.classList.add("hidden");
  });

  ui.fullscreenButton.addEventListener("pointerdown", toggleFullscreen);
  document.addEventListener("fullscreenchange", updateFullscreenButton);

  ui.toggleYaw.addEventListener("pointerdown", (e) => {
    if (e.target.classList.contains("toggle-option")) {
      settings.invertYaw = e.target.dataset.value === "reverse";
      ui.toggleYaw.querySelector(".active").classList.remove("active");
      e.target.classList.add("active");
    }
  });

  ui.togglePitch.addEventListener("pointerdown", (e) => {
    if (e.target.classList.contains("toggle-option")) {
      settings.invertPitch = e.target.dataset.value === "reverse";
      ui.togglePitch.querySelector(".active").classList.remove("active");
      e.target.classList.add("active");
    }
  });
  
  // 上下ボタンは mousedown/up も残してPCデバッグの利便性を維持
  const setupButtonEvents = (button, value) => {
    const start = () => input.verticalMove = value;
    const end = () => { if (input.verticalMove === value) input.verticalMove = 0; };
    button.addEventListener("pointerdown", start);
    button.addEventListener("pointerup", end);
    button.addEventListener("mousedown", start); // PC用
    button.addEventListener("mouseup", end); // PC用
    button.addEventListener("mouseleave", end); // PC用
  };
  setupButtonEvents(ui.upButton, 1);
  setupButtonEvents(ui.downButton, -1);
}

// ★★★ onTouch... ハンドラを削除し、onPointer... ハンドラを丸ごと追加 ★★★

function onPointerDown(event) {
  const target = event.target;

  // ジョイスティック操作か？
  if (target.closest("#joystick-container") && input.joystick.pointerId === null) {
    event.preventDefault();
    input.joystick.active = true;
    input.joystick.pointerId = event.pointerId;
    // ポインターイベントをジョイスティック要素に限定
    target.closest("#joystick-container").setPointerCapture(event.pointerId);
    updateJoystick(event);
    return;
  }

  // 他のUI要素は自身のリスナーに任せるので、ここでは何もしない
  if (
    target.closest("#gyro-button") ||
    target.closest("#top-left-controls") ||
    target.closest("#vertical-controls") ||
    target.closest("#settings-modal-overlay")
  ) {
    return;
  }

  // 上記のいずれでもないなら、視点操作用のタッチとする
  if (input.view.pointerId === null) {
    event.preventDefault();
    input.view.active = true;
    input.view.pointerId = event.pointerId;
    input.view.startX = event.clientX;
    input.view.startY = event.clientY;
    // ポインターイベントをbody要素に限定
    document.body.setPointerCapture(event.pointerId);
  }
}

function onPointerMove(event) {
  // ジョイスティック操作の更新
  if (event.pointerId === input.joystick.pointerId) {
    event.preventDefault();
    updateJoystick(event);
    return;
  }

  // 視点操作の更新
  if (event.pointerId === input.view.pointerId) {
    event.preventDefault();
    const deltaX = event.clientX - input.view.startX;
    const deltaY = event.clientY - input.view.startY;

    const yawDirection = settings.invertYaw ? -1 : 1;
    const pitchDirection = settings.invertPitch ? -1 : 1;

    controls.touchYaw += yawDirection * deltaX * 0.002;
    controls.touchPitch += pitchDirection * deltaY * 0.002;

    controls.touchPitch = Math.max(
      -Math.PI / 2,
      Math.min(Math.PI / 2, controls.touchPitch)
    );

    input.view.startX = event.clientX;
    input.view.startY = event.clientY;
  }
}

function onPointerUp(event) {
  // ジョイスティック操作の終了
  if (event.pointerId === input.joystick.pointerId) {
    event.preventDefault();
    input.joystick.active = false;
    input.joystick.pointerId = null;
    document.getElementById("joystick-knob").style.transform = `translate(0px, 0px)`;
    input.joystick.x = 0;
    input.joystick.y = 0;
    document.getElementById("joystick-container").releasePointerCapture(event.pointerId);
  }

  // 視点操作の終了
  if (event.pointerId === input.view.pointerId) {
    event.preventDefault();
    input.view.active = false;
    input.view.pointerId = null;
    document.body.releasePointerCapture(event.pointerId);
  }
}

// updateJoystickの引数をtouchからeventに変更
function updateJoystick(event) {
    // ...
}