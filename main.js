import * as THREE from 'three';

let scene, camera, renderer, clock;
let floor, testObject; // 変数名をcubeからtestObjectに変更
let deviceOrientationBase = null; // ジャイロの基準点を保存する変数
let debugMonitor; // デバッグ情報を表示するDOM要素
let orientationWarning; // 画面の向きに関する警告DOM要素
const Z_AXIS = new THREE.Vector3(0, 0, 1);

// プレイヤー（カメラ）の状態
const player = {
    speed: 5.0,
    velocity: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    rotation: new THREE.Euler(0, 0, 0, 'YXZ'),
    pitchObject: new THREE.Object3D(), // 垂直方向の視点移動を管理
};

// 入力状態
const controls = {
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    joystick: {
        active: false,
        x: 0,
        y: 0,
    },
    touch: {
        active: false,
        startX: 0,
        startY: 0,
        x: 0,
        y: 0,
    },
    gyro: {
        active: false,
        deviceOrientation: {},
    }
};

// --- 初期化処理 ---
function init() {
    // クロック
    clock = new THREE.Clock();

    // シーン
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // 空の色
    scene.fog = new THREE.Fog(0x87ceeb, 0, 75);

    // レンダラー
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    // カメラ
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    player.pitchObject.add(camera);
    scene.add(player.pitchObject);

    // ライト
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 0).normalize();
    scene.add(directionalLight);

    // 地面
    const floorGeometry = new THREE.PlaneGeometry(200, 200);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x999999 });
    floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // 3Dモデルの代わりとなる円錐
    const coneRadius = 1;
    const coneHeight = 2;
    const coneGeometry = new THREE.ConeGeometry(coneRadius, coneHeight, 32); // (半径, 高さ, 円周の分割数)
    const coneMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    testObject = new THREE.Mesh(coneGeometry, coneMaterial);
    
    // 円錐の底面が地面(y=0)に接するように、位置を高さの半分だけ上に設定
    testObject.position.set(0, coneHeight / 2, -10); 
    scene.add(testObject);

    // UI要素のセットアップ
    setupDebugMonitor();
    setupOrientationWarning();
    
    // イベントリスナーの登録
    setupEventListeners();

    // 初回の画面向きチェック
    checkScreenOrientation();

    // アニメーションループ開始
    animate();
}

// --- UI要素のセットアップ ---
function setupDebugMonitor() {
    debugMonitor = document.createElement('div');
    debugMonitor.id = 'debug-monitor';
    debugMonitor.style.position = 'fixed';
    debugMonitor.style.top = '10px';
    debugMonitor.style.right = '10px';
    debugMonitor.style.padding = '10px';
    debugMonitor.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    debugMonitor.style.color = 'white';
    debugMonitor.style.fontFamily = 'monospace';
    debugMonitor.style.zIndex = '100';
    debugMonitor.innerHTML = 'ジャイロ待機中...';
    document.body.appendChild(debugMonitor);
}

function setupOrientationWarning() {
    orientationWarning = document.createElement('div');
    orientationWarning.id = 'orientation-warning';
    orientationWarning.style.position = 'fixed';
    orientationWarning.style.top = '0';
    orientationWarning.style.left = '0';
    orientationWarning.style.width = '100%';
    orientationWarning.style.height = '100%';
    orientationWarning.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    orientationWarning.style.color = 'white';
    orientationWarning.style.display = 'none'; // 最初は非表示
    orientationWarning.style.justifyContent = 'center';
    orientationWarning.style.alignItems = 'center';
    orientationWarning.style.fontSize = '24px';
    orientationWarning.style.zIndex = '200';
    orientationWarning.innerHTML = '画面を横にしてください';
    document.body.appendChild(orientationWarning);
}

// --- イベントリスナーの設定 ---
function setupEventListeners() {
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('orientationchange', checkScreenOrientation);
    
    // ジョイスティック
    const joystickContainer = document.getElementById('joystick-container');
    const joystickKnob = document.getElementById('joystick-knob');
    
    joystickContainer.addEventListener('touchstart', onJoystickStart, { passive: false });
    joystickContainer.addEventListener('touchmove', onJoystickMove, { passive: false });
    joystickContainer.addEventListener('touchend', onJoystickEnd);
    
    // 画面右側のタッチによる視点移動
    window.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);

    // ジャイロ有効化ボタン
    const gyroButton = document.getElementById('gyro-button');
    gyroButton.addEventListener('click', requestDeviceOrientation);
}

// --- ジャイロセンサーの有効化 ---
function requestDeviceOrientation() {
    // iOS 13+ ではユーザーの許可が必要
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().then(permissionState => {
            if (permissionState === 'granted') {
                window.addEventListener('deviceorientation', onDeviceOrientation);
                controls.gyro.active = true;
            }
            document.getElementById('gyro-button').style.display = 'none';
        }).catch(console.error);
    } else {
        // その他のデバイス（Androidなど）
        window.addEventListener('deviceorientation', onDeviceOrientation);
        controls.gyro.active = true;
        document.getElementById('gyro-button').style.display = 'none';
    }
}

// --- 各種イベントハンドラ ---
function checkScreenOrientation() {
    if (window.innerHeight > window.innerWidth) {
        orientationWarning.style.display = 'flex';
    } else {
        orientationWarning.style.display = 'none';
    }
}


function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    checkScreenOrientation(); // リサイズ時にもチェック
}

// ジョイスティック操作
// ... (変更なし) ...
function onJoystickStart(event) {
    event.preventDefault();
    controls.joystick.active = true;
}

function onJoystickMove(event) {
    event.preventDefault();
    if (!controls.joystick.active) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    const touch = event.touches[0];
    
    const x = (touch.clientX - rect.left - rect.width / 2);
    const y = (touch.clientY - rect.top - rect.height / 2);
    
    const distance = Math.sqrt(x*x + y*y);
    const maxDistance = rect.width / 2;

    const clampedX = (distance > maxDistance) ? x / distance * maxDistance : x;
    const clampedY = (distance > maxDistance) ? y / distance * maxDistance : y;

    const knob = document.getElementById('joystick-knob');
    knob.style.transform = `translate(${clampedX}px, ${clampedY}px)`;

    controls.joystick.x = clampedX / maxDistance;
    controls.joystick.y = clampedY / maxDistance;
}

function onJoystickEnd() {
    controls.joystick.active = false;
    document.getElementById('joystick-knob').style.transform = `translate(0px, 0px)`;
    controls.joystick.x = 0;
    controls.joystick.y = 0;
}

// 画面タッチによる視点移動
// ... (変更なし) ...
function onTouchStart(event) {
    // ジョイスティック上でのタッチは無視
    if (event.target.closest('#joystick-container')) return;
    
    const touch = event.touches[0];
    // 画面の左半分でのタッチは無視
    if (touch.clientX < window.innerWidth / 2) return;
    
    controls.touch.active = true;
    controls.touch.startX = touch.clientX;
    controls.touch.startY = touch.clientY;
}

function onTouchMove(event) {
    if (!controls.touch.active) return;
    
    const touch = event.touches[0];
    const deltaX = touch.clientX - controls.touch.startX;
    const deltaY = touch.clientY - controls.touch.startY;

    // 回転量を計算
    player.rotation.y -= deltaX * 0.002;
    player.rotation.x -= deltaY * 0.002;
    
    // 垂直方向の回転制限
    player.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, player.rotation.x));
    
    controls.touch.startX = touch.clientX;
    controls.touch.startY = touch.clientY;
}

function onTouchEnd() {
    controls.touch.active = false;
}

// ジャイロセンサー
function onDeviceOrientation(event) {
    if (!event.alpha) return;

    // 初回のジャイロデータで基準となる向きを記録
    if (!deviceOrientationBase) {
        deviceOrientationBase = {
            alpha: event.alpha,
            beta: event.beta,
            gamma: event.gamma,
        };
    }
    controls.gyro.deviceOrientation = event;
}


// --- アニメーションループ ---
function animate() {
    requestAnimationFrame(animate);

    const deltaTime = clock.getDelta();
    
    updatePlayer(deltaTime);
    
    renderer.render(scene, camera);
}

// --- プレイヤー（カメラ）の状態更新 ---
function updatePlayer(deltaTime) {
    // 1. 視点（カメラの向き）の更新
    // ジャイロが有効な場合
    if (controls.gyro.active && controls.gyro.deviceOrientation.alpha && deviceOrientationBase) {
        // --- ジャイロによる回転計算 ---
        const currentOrientation = controls.gyro.deviceOrientation;

        // デバッグモニターの表示を更新
        debugMonitor.innerHTML = `
            Alpha (ヨー): ${currentOrientation.alpha.toFixed(2)}<br>
            Beta (ピッチ): ${currentOrientation.beta.toFixed(2)}<br>
            Gamma (ロール): ${(currentOrientation.gamma || 0).toFixed(2)}
        `;
        
        // 基準からの差分を計算
        const deltaAlpha = currentOrientation.alpha - deviceOrientationBase.alpha;
        const deltaBeta = currentOrientation.beta - deviceOrientationBase.beta;
        const deltaGamma = (currentOrientation.gamma || 0) - (deviceOrientationBase.gamma || 0);
        
        // ★★★ 変更点: ロール(gamma)で上下(X軸回転)、ヨー(alpha)で左右(Y軸回転)を操作するように軸を入れ替え ★★★
        const euler = new THREE.Euler(
            THREE.MathUtils.degToRad(deltaGamma), // 視点の上下 (Pitch) を、デバイスのロール (gamma) で操作
            THREE.MathUtils.degToRad(deltaAlpha), // 視点の左右 (Yaw) を、デバイスのヨー (alpha) で操作
            -THREE.MathUtils.degToRad(deltaBeta), // 視点のロールを、デバイスのピッチ (beta) で操作
            'YXZ'
        );
        const gyroQuaternion = new THREE.Quaternion().setFromEuler(euler);

        // ★★★ 変更点: 横画面（左が上）を前提とした固定の補正をかける回転値を修正 ★★★
        const landscapeCorrection = new THREE.Quaternion().setFromAxisAngle(Z_AXIS, Math.PI / 2); // -90度から+90度回転に変更
        gyroQuaternion.premultiply(landscapeCorrection);


        // --- タッチによる回転計算 ---
        const touchQuaternion = new THREE.Quaternion().setFromEuler(player.rotation);

        // --- 合成と適用 ---
        // タッチ操作で決めた向きを基準に、ジャイロの差分を適用
        player.pitchObject.quaternion.copy(touchQuaternion).multiply(gyroQuaternion);

    } else {
        // ジャイロが無効な場合はタッチ操作のみ
        player.pitchObject.rotation.x = player.rotation.x;
        player.pitchObject.rotation.y = player.rotation.y;
    }

    // 2. 移動方向の計算 (前後を反転)
    const moveDirection = new THREE.Vector3(controls.joystick.x, 0, controls.joystick.y).normalize();

    // 3. 移動ベクトルの計算
    if (moveDirection.length() > 0) {
        // カメラのY軸回転（左右の向き）のみを移動に反映させる
        const moveQuaternion = new THREE.Quaternion();
        player.pitchObject.getWorldQuaternion(moveQuaternion);

        // 上下を向いた際に移動方向がおかしくならないよう、X軸とZ軸の回転をリセット
        const euler = new THREE.Euler().setFromQuaternion(moveQuaternion, 'YXZ');
        euler.x = 0;
        euler.z = 0;
        moveQuaternion.setFromEuler(euler);

        player.direction.copy(moveDirection).applyQuaternion(moveQuaternion);
    } else {
        player.direction.set(0, 0, 0);
    }
    
    player.velocity.copy(player.direction).multiplyScalar(player.speed * deltaTime);

    // 4. プレイヤーの位置を更新
    player.pitchObject.position.add(player.velocity);
}

// --- 実行開始 ---
init();

