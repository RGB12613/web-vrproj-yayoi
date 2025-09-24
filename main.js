import * as THREE from 'three';
import { DeviceOrientationControls } from './DeviceOrientationControls.local.js';
import { CONFIG } from './config.js';
import { SceneManager } from './sceneManager.js';

const VERSION = "9.7.1"; // バージョン番号を更新

let scene, camera, renderer, clock;
let floor;
let versionDisplay;
let orientationWarning;
let controls;
let sceneManager;
let water;

const ui = {
    settingsButton: null,
    modalOverlay: null,
    closeModalButton: null,
    upButton: null,
    downButton: null,
    resetViewButton: null,
    fullscreenButton: null,
    loadingScreen: null,
    progressBar: null,
    loadingText: null,
    uiContainer: null,
    gyroButton: null,
};

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
    touch: {
        active: false,
        startX: 0,
        startY: 0,
    },
    verticalMove: 0,
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

    sceneManager = new SceneManager(scene);
    const sun = sceneManager.setupLights();
    water = sceneManager.createWater(sun);


    // UI要素の取得
    versionDisplay = document.getElementById('version-display');
    orientationWarning = document.getElementById('orientation-warning');
    ui.settingsButton = document.getElementById('settings-button');
    ui.modalOverlay = document.getElementById('settings-modal-overlay');
    ui.closeModalButton = document.getElementById('close-modal-button');
    ui.upButton = document.getElementById('up-button');
    ui.downButton = document.getElementById('down-button');
    ui.resetViewButton = document.getElementById('reset-view-button');
    ui.fullscreenButton = document.getElementById('fullscreen-button');
    ui.loadingScreen = document.getElementById('loading-screen');
    ui.progressBar = document.getElementById('progress-bar');
    ui.loadingText = document.getElementById('loading-text');
    ui.uiContainer = document.getElementById('ui-container');
    ui.gyroButton = document.getElementById('gyro-button');

    
    const glbPath = CONFIG.ASSET_URL;
    console.log(`Attempting to load GLB from: ${glbPath}`);

    sceneManager.loadModel(
        glbPath,
        // onProgress (読み込み中)
        function (xhr) {
            if (xhr.lengthComputable && xhr.total > 0) {
                const percentComplete = xhr.loaded / xhr.total * 100;
                ui.progressBar.style.width = percentComplete + '%';
                ui.loadingText.textContent = Math.round(percentComplete) + '%';
            } else {
                const mbLoaded = (xhr.loaded / (1024 * 1024)).toFixed(1);
                ui.loadingText.textContent = `Loading... (${mbLoaded} MB)`;
            }
        },
        // onLoad (成功時)
        function (gltf) {
            console.log('GLB model loaded successfully.');
            
            ui.loadingScreen.style.opacity = '0';
            setTimeout(() => {
                ui.loadingScreen.classList.add('hidden');
                ui.uiContainer.classList.remove('hidden');
                ui.gyroButton.classList.remove('hidden');
            }, 500);
        },
        // onError (失敗時)
        function (error) {
            console.error('An error happened while loading the GLB model:', error);
            ui.loadingText.textContent = 'モデルの読み込みに失敗しました';
        }
    );


    controls = new DeviceOrientationControls(camera);
    
    updateVersionDisplay();
    setupEventListeners();
    checkScreenOrientation();
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

    window.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);

    ui.gyroButton.addEventListener('click', () => {
        controls.connect();
        ui.gyroButton.style.display = 'none';
    });
    
    ui.settingsButton.addEventListener('click', () => ui.modalOverlay.classList.remove('hidden'));
    ui.closeModalButton.addEventListener('click', () => ui.modalOverlay.classList.add('hidden'));
    ui.modalOverlay.addEventListener('click', (e) => {
        if (e.target === ui.modalOverlay) {
            ui.modalOverlay.classList.add('hidden');
        }
    });

    ui.resetViewButton.addEventListener('click', () => {
        if (controls) {
            controls.resetView();
        }
        ui.modalOverlay.classList.add('hidden');
    });

    ui.fullscreenButton.addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', updateFullscreenButton);


    ui.upButton.addEventListener('touchstart', () => { input.verticalMove = 1; });
    ui.downButton.addEventListener('touchstart', () => { input.verticalMove = -1; });
    ui.upButton.addEventListener('touchend', () => { if (input.verticalMove === 1) input.verticalMove = 0; });
    ui.downButton.addEventListener('touchend', () => { if (input.verticalMove === -1) input.verticalMove = 0; });
    ui.upButton.addEventListener('mousedown', () => { input.verticalMove = 1; });
    ui.downButton.addEventListener('mousedown', () => { input.verticalMove = -1; });
    ui.upButton.addEventListener('mouseup', () => { if (input.verticalMove === 1) input.verticalMove = 0; });
    ui.downButton.addEventListener('mouseup', () => { if (input.verticalMove === -1) input.verticalMove = 0; });
    ui.upButton.addEventListener('mouseleave', () => { if (input.verticalMove === 1) input.verticalMove = 0; });
    ui.downButton.addEventListener('mouseleave', () => { if (input.verticalMove === -1) input.verticalMove = 0; });

}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

function updateFullscreenButton() {
    if (!document.fullscreenElement) {
        ui.fullscreenButton.textContent = 'フルスクリーン表示';
    } else {
        ui.fullscreenButton.textContent = 'フルスクリーン解除';
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

// タッチによる視点操作のハンドラ
function onTouchStart(event) {
    if (event.target.closest('#joystick-container') || event.target.closest('#vertical-controls')) return;
    
    const touch = event.touches[0];
    if (event.target.closest('#settings-button')) return;
    
    input.touch.active = true;
    input.touch.startX = touch.clientX;
    input.touch.startY = touch.clientY;
}

function onTouchMove(event) {
    if (!input.touch.active) return;
    
    const touch = event.touches[0];
    const deltaX = touch.clientX - input.touch.startX;
    const deltaY = touch.clientY - input.touch.startY;

    controls.touchYaw -= deltaX * 0.002;
    controls.touchPitch -= deltaY * 0.002; 
    
    controls.touchPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, controls.touchPitch));
    
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

    if (water) {
        water.material.uniforms['time'].value += deltaTime;
    }

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
    
    const verticalVelocity = input.verticalMove * player.speed * deltaTime;
    camera.position.y += verticalVelocity;
}

// --- 実行開始 ---
window.addEventListener('DOMContentLoaded', init);

