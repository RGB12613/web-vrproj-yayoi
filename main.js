import * as THREE from 'three';
import { DeviceOrientationControls } from './DeviceOrientationControls.local.js';
import { CONFIG } from './config.js';
import { SceneManager } from './sceneManager.js';

const VERSION = '10.0 - Revert & Fix Scroll'; // バージョン番号を更新

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
    toggleYaw: null,
    togglePitch: null,
};

const settings = {
    invertYaw: false,
    invertPitch: false,
};


const player = {
    speed: 5.0,
    velocity: new THREE.Vector3(),
    direction: new THREE.Vector3(),
};

const input = {
    joystick: {
        active: false,
        identifier: null,
        x: 0,
        y: 0,
    },
    touch: {
        active: false,
        identifier: null,
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
    ui.toggleYaw = document.getElementById('toggle-yaw');
    ui.togglePitch = document.getElementById('toggle-pitch');

    
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
    
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: false });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: false });


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
    
    ui.toggleYaw.addEventListener('click', (e) => {
        if (e.target.classList.contains('toggle-option')) {
            settings.invertYaw = e.target.dataset.value === 'reverse';
            ui.toggleYaw.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
        }
    });

    ui.togglePitch.addEventListener('click', (e) => {
        if (e.target.classList.contains('toggle-option')) {
            settings.invertPitch = e.target.dataset.value === 'reverse';
            ui.togglePitch.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
        }
    });
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
    // This function is now mostly handled by the check in animate()
    // but we keep it for orientation changes.
    checkScreenOrientation();
}

// --- マルチタッチ処理 ---
function handleTouchStart(event) {
    event.preventDefault();

    for (const touch of event.changedTouches) {
        if (touch.target.closest('#joystick-container') && !input.joystick.active) {
            input.joystick.active = true;
            input.joystick.identifier = touch.identifier;
        }
        else if (touch.target.closest('#up-button')) {
            input.verticalMove = 1;
        }
        else if (touch.target.closest('#down-button')) {
            input.verticalMove = -1;
        }
        else if (!input.touch.active) {
            input.touch.active = true;
            input.touch.identifier = touch.identifier;
            input.touch.startX = touch.clientX;
            input.touch.startY = touch.clientY;
        }
    }
}

function handleTouchMove(event) {
    event.preventDefault();

    for (const touch of event.changedTouches) {
        if (touch.identifier === input.joystick.identifier) {
            const rect = document.getElementById('joystick-container').getBoundingClientRect();
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
        else if (touch.identifier === input.touch.identifier) {
            const deltaX = touch.clientX - input.touch.startX;
            const deltaY = touch.clientY - input.touch.startY;

            const yawDirection = settings.invertYaw ? -1 : 1;
            const pitchDirection = settings.invertPitch ? -1 : 1;

            controls.touchYaw += yawDirection * deltaX * 0.002;
            controls.touchPitch += pitchDirection * deltaY * 0.002; 
            
            controls.touchPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, controls.touchPitch));
            
            input.touch.startX = touch.clientX;
            input.touch.startY = touch.clientY;
        }
    }
}

function handleTouchEnd(event) {
    event.preventDefault();
    
    for (const touch of event.changedTouches) {
        if (touch.identifier === input.joystick.identifier) {
            input.joystick.active = false;
            input.joystick.identifier = null;
            document.getElementById('joystick-knob').style.transform = `translate(0px, 0px)`;
            input.joystick.x = 0;
            input.joystick.y = 0;
        }
        else if (touch.identifier === input.touch.identifier) {
            input.touch.active = false;
            input.touch.identifier = null;
        }
    }

    // Stop vertical move if any of the up/down buttons were released
    let verticalTouchStillActive = false;
    for (const touch of event.touches) {
        if (touch.target.closest('#up-button') || touch.target.closest('#down-button')) {
            verticalTouchStillActive = true;
            break;
        }
    }
    if (!verticalTouchStillActive) {
        input.verticalMove = 0;
    }
}


// --- アニメーションループ ---
function animate() {
    requestAnimationFrame(animate);

    const canvas = renderer.domElement;
    if (canvas.clientWidth !== canvas.width || canvas.clientHeight !== canvas.height) {
        renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
    }

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

