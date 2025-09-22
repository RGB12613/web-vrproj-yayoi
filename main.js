import * as THREE from 'three';

let scene, camera, renderer, clock;
let floor, cube;
let deviceOrientationBase = null; // ジャイロの基準点を保存する変数
let screenOrientation = 0; // 画面の向きを保存する変数
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

    // 3Dモデルの代わりとなるキューブ
    const boxGeometry = new THREE.BoxGeometry(2, 2, 2);
    const boxMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    cube = new THREE.Mesh(boxGeometry, boxMaterial);
    cube.position.set(0, 1, -10);
    scene.add(cube);
    
    // イベントリスナーの登録
    setupEventListeners();

    // アニメーションループ開始
    animate();
}

// --- イベントリスナーの設定 ---
function setupEventListeners() {
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('orientationchange', onScreenOrientationChange);
    onScreenOrientationChange(); // 初期値を設定
    
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

function onScreenOrientationChange() {
    screenOrientation = window.screen.orientation.angle || window.orientation || 0;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ジョイスティック操作
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
        
        // 基準からの差分を計算
        const deltaAlpha = currentOrientation.alpha - deviceOrientationBase.alpha;
        const deltaBeta = currentOrientation.beta - deviceOrientationBase.beta;
        const deltaGamma = (currentOrientation.gamma || 0) - (deviceOrientationBase.gamma || 0);
        
        const euler = new THREE.Euler(
            THREE.MathUtils.degToRad(deltaBeta),
            THREE.MathUtils.degToRad(deltaAlpha),
            -THREE.MathUtils.degToRad(deltaGamma), // Rollを追加し、一般的な右手系に合わせるために反転
            'YXZ'
        );
        const gyroQuaternion = new THREE.Quaternion().setFromEuler(euler);

        // 画面の向きに合わせてジャイロの回転を補正
        const screenCorrection = new THREE.Quaternion().setFromAxisAngle(Z_AXIS, -THREE.MathUtils.degToRad(screenOrientation));
        gyroQuaternion.premultiply(screenCorrection);

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

