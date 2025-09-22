import * as THREE from 'three';
// DeviceOrientationControlsをアドオンからインポート
import { DeviceOrientationControls } from 'three/addons/controls/DeviceOrientationControls.js';

const VERSION = 'v2.8'; // バージョン番号を更新

let scene, camera, renderer, clock;
let floor, testObject;
let debugMonitor;
let orientationWarning;
let controls; // Three.jsのControlsを格納する変数

// プレイヤー（カメラ）の状態
const player = {
    speed: 5.0,
    velocity: new THREE.Vector3(),
    direction: new THREE.Vector3(),
};

// 入力状態
const input = {
    joystick: {
        active: false,
        x: 0,
        y: 0,
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
    scene.add(camera);

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

    controls = new DeviceOrientationControls(camera);

    // ★★★ 変更点: HTMLからUI要素を取得するように変更 ★★★
    debugMonitor = document.getElementById('debug-monitor');
    orientationWarning = document.getElementById('orientation-warning');
    
    updateDebugMonitor(); // 初期表示
    setupEventListeners();
    checkScreenOrientation(); // 初回チェック
    animate();
}

// --- UI要素の更新 ---
function updateDebugMonitor() {
    debugMonitor.innerHTML = `Version: ${VERSION}<br>API: DeviceOrientationControls`;
}


// --- イベントリスナーの設定 ---
function setupEventListeners() {
    // ★★★ 変更点: orientationchangeイベントを削除し、resizeイベントに統合 ★★★
    window.addEventListener('resize', onWindowResize);
    
    const joystickContainer = document.getElementById('joystick-container');
    joystickContainer.addEventListener('touchstart', onJoystickStart, { passive: false });
    joystickContainer.addEventListener('touchmove', onJoystickMove, { passive: false });
    joystickContainer.addEventListener('touchend', onJoystickEnd);

    // ボタンの処理をControlsの接続に変更
    document.getElementById('gyro-button').addEventListener('click', () => {
        controls.connect();
        document.getElementById('gyro-button').style.display = 'none';
    });
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
    checkScreenOrientation(); // 画面リサイズ時に向きもチェック
}

// --- ジョイスティック操作 (変更なし) ---
function onJoystickStart(event) {
    event.preventDefault();
    input.joystick.active = true;
}

function onJoystickMove(event) {
    event.preventDefault();
    if (!input.joystick.active) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const touch = event.touches[0];
    const x = (touch.clientX - rect.left - rect.width / 2);
    const y = (touch.clientY - rect.top - rect.height / 2);
    const distance = Math.sqrt(x*x + y*y);
    const maxDistance = rect.width / 2;
    const clampedX = (distance > maxDistance) ? x / distance * maxDistance : x;
    const clampedY = (distance > maxDistance) ? y / distance * maxDistance : y;
    document.getElementById('joystick-knob').style.transform = `translate(${clampedX}px, ${clampedY}px)`;
    input.joystick.x = clampedX / maxDistance;
    input.joystick.y = clampedY / maxDistance;
}

function onJoystickEnd() {
    input.joystick.active = false;
    document.getElementById('joystick-knob').style.transform = `translate(0px, 0px)`;
    input.joystick.x = 0;
    input.joystick.y = 0;
}


// --- アニメーションループ ---
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    
    // コントローラーの状態を更新
    controls.update();
    
    updatePlayer(deltaTime);
    renderer.render(scene, camera);
}

// --- プレイヤーの移動更新 ---
function updatePlayer(deltaTime) {
    // 移動ベクトルの計算
    const moveDirection = new THREE.Vector3(input.joystick.x, 0, input.joystick.y);
    
    if (moveDirection.length() > 0.01) {
        const moveQuaternion = new THREE.Quaternion();
        camera.getWorldQuaternion(moveQuaternion);

        // 上下を向いた際に移動方向がおかしくならないよう、X軸とZ軸の回転をリセット
        const euler = new THREE.Euler().setFromQuaternion(moveQuaternion, 'YXZ');
        euler.x = 0;
        euler.z = 0;
        moveQuaternion.setFromEuler(euler);

        player.direction.copy(moveDirection).applyQuaternion(moveQuaternion).normalize();
    } else {
        player.direction.set(0, 0, 0);
    }
    
    player.velocity.copy(player.direction).multiplyScalar(player.speed * deltaTime);
    camera.position.add(player.velocity);
}

// --- 実行開始 ---
init();

