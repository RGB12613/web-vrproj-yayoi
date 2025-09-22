import * as THREE from 'three';

const VERSION = 'v1.4'; // バージョン番号を更新

let scene, camera, renderer, clock;
let floor, testObject;
let debugMonitor;
let orientationWarning;

// ★★★ 変更点: ジャイロの回転を管理する変数を追加 ★★★
let gyroActive = false;
let baseQuaternionInverse = new THREE.Quaternion(); // ジャイロ有効化時の向きの逆クォータニオン
const currentDeviceQuaternion = new THREE.Quaternion(); // 現在のデバイスの向き

// プレイヤー（カメラ）の状態
const player = {
    speed: 5.0,
    velocity: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    rotation: new THREE.Euler(0, 0, 0, 'YXZ'),
    pitchObject: new THREE.Object3D(),
};

// 入力状態
const controls = {
    joystick: {
        active: false,
        x: 0,
        y: 0,
    },
    touch: {
        active: false,
        startX: 0,
        startY: 0,
    },
};

// --- 初期化処理 ---
function init() {
    clock = new THREE.Clock();
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 0, 75);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    player.pitchObject.add(camera);
    scene.add(player.pitchObject);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 0).normalize();
    scene.add(directionalLight);

    const floorGeometry = new THREE.PlaneGeometry(200, 200);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x999999 });
    floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const coneRadius = 1;
    const coneHeight = 2;
    const coneGeometry = new THREE.ConeGeometry(coneRadius, coneHeight, 32);
    const coneMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    testObject = new THREE.Mesh(coneGeometry, coneMaterial);
    testObject.position.set(0, coneHeight / 2, -10);
    scene.add(testObject);

    setupDebugMonitor();
    setupOrientationWarning();
    setupEventListeners();
    checkScreenOrientation();
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
    debugMonitor.innerHTML = `Version: ${VERSION}<br>ジャイロ待機中...`;
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
    orientationWarning.style.display = 'none';
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
    
    const joystickContainer = document.getElementById('joystick-container');
    joystickContainer.addEventListener('touchstart', onJoystickStart, { passive: false });
    joystickContainer.addEventListener('touchmove', onJoystickMove, { passive: false });
    joystickContainer.addEventListener('touchend', onJoystickEnd);
    
    window.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);

    document.getElementById('gyro-button').addEventListener('click', requestDeviceOrientation);
}

// --- ジャイロセンサーの有効化 ---
function requestDeviceOrientation() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().then(permissionState => {
            if (permissionState === 'granted') {
                gyroActive = true;
                // ★★★ 変更点: 最初の向きを基準として設定するリスナーを一度だけ実行 ★★★
                window.addEventListener('deviceorientation', setBaseOrientation, { once: true });
            }
            document.getElementById('gyro-button').style.display = 'none';
        }).catch(console.error);
    } else {
        gyroActive = true;
        window.addEventListener('deviceorientation', setBaseOrientation, { once: true });
        document.getElementById('gyro-button').style.display = 'none';
    }
}

// ★★★ 変更点: 最初のジャイロイベントで基準の向きを設定する関数 ★★★
function setBaseOrientation(event) {
    if (!event.alpha) return;
    updateDeviceQuaternion(event); // 現在の向きを計算
    baseQuaternionInverse.copy(currentDeviceQuaternion).invert(); // その逆クォータニオンを基準として保存
    // 通常の更新用リスナーを登録
    window.addEventListener('deviceorientation', onDeviceOrientation);
}

// --- 各種イベントハンドラ ---
function onDeviceOrientation(event) {
    if (!event.alpha) return;
    updateDeviceQuaternion(event);
}

// ★★★ 変更点: デバイスの向きからクォータニオンを計算する処理を独立 ★★★
const screenTransform = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2);
const worldTransform = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(-1, 0, 0), Math.PI / 2);

function updateDeviceQuaternion(event) {
    const alpha = THREE.MathUtils.degToRad(event.alpha); // Z
    const beta = THREE.MathUtils.degToRad(event.beta);   // X
    const gamma = THREE.MathUtils.degToRad(event.gamma); // Y

    const euler = new THREE.Euler(beta, alpha, -gamma, 'YXZ');
    currentDeviceQuaternion.setFromEuler(euler);
    currentDeviceQuaternion.multiply(screenTransform);
    currentDeviceQuaternion.multiply(worldTransform);

    // デバッグ表示
    debugMonitor.innerHTML = `
        Version: ${VERSION}<br>
        Alpha (ヨー): ${event.alpha.toFixed(2)}<br>
        Beta (ピッチ): ${event.beta.toFixed(2)}<br>
        Gamma (ロール): ${(event.gamma || 0).toFixed(2)}
    `;
}

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
    checkScreenOrientation();
}

// --- ジョイスティックとタッチ操作 (変更なし) ---
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
    document.getElementById('joystick-knob').style.transform = `translate(${clampedX}px, ${clampedY}px)`;
    controls.joystick.x = clampedX / maxDistance;
    controls.joystick.y = clampedY / maxDistance;
}

function onJoystickEnd() {
    controls.joystick.active = false;
    document.getElementById('joystick-knob').style.transform = `translate(0px, 0px)`;
    controls.joystick.x = 0;
    controls.joystick.y = 0;
}

function onTouchStart(event) {
    if (event.target.closest('#joystick-container')) return;
    const touch = event.touches[0];
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
    player.rotation.y -= deltaX * 0.002;
    player.rotation.x -= deltaY * 0.002;
    player.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, player.rotation.x));
    controls.touch.startX = touch.clientX;
    controls.touch.startY = touch.clientY;
}

function onTouchEnd() {
    controls.touch.active = false;
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
    const touchQuaternion = new THREE.Quaternion().setFromEuler(player.rotation);

    if (gyroActive) {
        // ★★★ 変更点: 基準からの相対回転を計算 ★★★
        const relativeGyroQuaternion = currentDeviceQuaternion.clone().multiply(baseQuaternionInverse);
        player.pitchObject.quaternion.copy(touchQuaternion).multiply(relativeGyroQuaternion);
    } else {
        player.pitchObject.quaternion.copy(touchQuaternion);
    }

    // 2. 移動ベクトルの計算
    const moveDirection = new THREE.Vector3(controls.joystick.x, 0, controls.joystick.y);
    if (moveDirection.length() > 0.01) {
        const moveQuaternion = new THREE.Quaternion();
        player.pitchObject.getWorldQuaternion(moveQuaternion);

        const euler = new THREE.Euler().setFromQuaternion(moveQuaternion, 'YXZ');
        euler.x = 0;
        euler.z = 0;
        moveQuaternion.setFromEuler(euler);

        player.direction.copy(moveDirection).applyQuaternion(moveQuaternion).normalize();
    } else {
        player.direction.set(0, 0, 0);
    }
    
    player.velocity.copy(player.direction).multiplyScalar(player.speed * deltaTime);
    player.pitchObject.position.add(player.velocity);
}

// --- 実行開始 ---
init();

