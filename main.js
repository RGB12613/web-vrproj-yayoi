import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { DeviceOrientationControls } from './DeviceOrientationControls.local.js';

const VERSION = 'v4.3 - Touch Restore'; // バージョン番号を更新

let scene, camera, renderer, clock;
let floor, testObject;
let versionDisplay;
let orientationWarning;
let controls;

const player = {
    speed: 5.0,
    velocity: new THREE.Vector3(),
    direction: new THREE.Vector3(),
};

const input = {
    joystick: {
        active: false,
        x: 0,
        y: 0,
    },
    // ★★★ 変更点: タッチ操作の状態を保持するオブジェクトを追加 ★★★
    touch: {
        active: false,
        startX: 0,
        startY: 0,
    }
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
    
    versionDisplay = document.getElementById('version-display');
    orientationWarning = document.getElementById('orientation-warning');
    
    updateVersionDisplay();
    setupEventListeners();
    checkScreenOrientation(); // 初回実行
    animate();
}

// --- UI要素の更新 ---
function updateVersionDisplay() {
    versionDisplay.innerHTML = `v${VERSION}`;
}

// --- イベントリスナーの設定 ---
function setupEventListeners() {
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('orientationchange', checkScreenOrientation);
    
    const joystickContainer = document.getElementById('joystick-container');
    joystickContainer.addEventListener('touchstart', onJoystickStart, { passive: false });
    joystickContainer.addEventListener('touchmove', onJoystickMove, { passive: false });
    joystickContainer.addEventListener('touchend', onJoystickEnd);

    // ★★★ 変更点: タッチによる視点操作のイベントリスナーを再実装 ★★★
    window.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);

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
    checkScreenOrientation();
}

// --- ジョイスティック操作 ---
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

// ★★★ 変更点: タッチによる視点操作のハンドラを再実装 ★★★
function onTouchStart(event) {
    if (event.target.closest('#joystick-container')) return;
    
    const touch = event.touches[0];
    if (touch.clientX < window.innerWidth / 2) return;
    
    input.touch.active = true;
    input.touch.startX = touch.clientX;
    input.touch.startY = touch.clientY;
}

function onTouchMove(event) {
    if (!input.touch.active) return;
    
    const touch = event.touches[0];
    const deltaX = touch.clientX - input.touch.startX;
    const deltaY = touch.clientY - input.touch.startY;

    // スワイプ量をDeviceOrientationControlsのtouchEulerに加算
    controls.touchEuler.y -= deltaX * 0.002;
    controls.touchEuler.x -= deltaY * 0.002;
    
    // 上下の回転範囲を制限 (±90度)
    controls.touchEuler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, controls.touchEuler.x));
    
    input.touch.startX = touch.clientX;
    input.touch.startY = touch.clientY;
}

function onTouchEnd() {
    input.touch.active = false;
}


// --- アニメーションループ ---
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    controls.update();
    updatePlayer(deltaTime);
    renderer.render(scene, camera);
}

// --- プレイヤーの移動更新 ---
function updatePlayer(deltaTime) {
    const moveDirection = new THREE.Vector3(input.joystick.x, 0, input.joystick.y);
    if (moveDirection.length() > 0.01) {
        const moveQuaternion = new THREE.Quaternion();
        camera.getWorldQuaternion(moveQuaternion);
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
window.addEventListener('DOMContentLoaded', init);

