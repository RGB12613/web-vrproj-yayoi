import * as THREE from 'three';

const _zee = new THREE.Vector3(0, 0, 1);
const _euler = new THREE.Euler();
const _q0 = new THREE.Quaternion();
const _q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // - PI/2 around the x-axis

const _changeEvent = { type: 'change' };

class DeviceOrientationControls extends THREE.EventDispatcher {

	constructor(object) {

		super();

		if (window.isSecureContext === false) {

			console.error('THREE.DeviceOrientationControls: DeviceOrientationEvent is only available in secure contexts (https)');

		}

		const scope = this;

		const EPS = 0.000001;
		const lastQuaternion = new THREE.Quaternion();

		this.object = object;
		this.object.rotation.reorder('YXZ');

		this.enabled = true;

		this.deviceOrientation = {};
		this.screenOrientation = 0;

		this.alphaOffset = 0; // radians
		
		this.touchYaw = 0;
		this.touchPitch = 0;
		
		let firstReading = true;

		const onDeviceOrientationChangeEvent = function (event) {
			
			if (firstReading) {
				if (event.webkitCompassHeading) {
					// iOSの高精度な方位を利用
					scope.alphaOffset = -THREE.MathUtils.degToRad(event.webkitCompassHeading);
				} else {
					// Androidなどでは、最初の向きを正面とする
					scope.alphaOffset = -THREE.MathUtils.degToRad(event.alpha);
				}
				firstReading = false;
			}
			
			scope.deviceOrientation = event;
		};

		const onScreenOrientationChangeEvent = function () {

			scope.screenOrientation = window.orientation || 0;

		};

		const setObjectQuaternion = function (quaternion, alpha, beta, gamma, orient) {
			
			// ★★★ 変更点: 回転ロジックを全面的に再構築 ★★★

			// 1. ジャイロセンサーから基本となる向きを計算 (ヨーを反転)
			_euler.set(beta, -alpha, -gamma, 'YXZ'); // ヨー(alpha)を反転させて直感的な操作に
			const gyroQuaternion = new THREE.Quaternion().setFromEuler(_euler);
			gyroQuaternion.multiply(_q1); // camera looks out the back of the device, not the top
			gyroQuaternion.multiply(_q0.setFromAxisAngle(_zee, -orient)); // adjust for screen orientation
			
			// 2. タッチ操作によるヨー回転（左右）をワールドのY軸基準で作成
			const qTouchYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), scope.touchYaw);
			
			// 3. タッチ操作によるピッチ回転（上下）をカメラのローカルX軸基準で作成
			const qTouchPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), scope.touchPitch);

			// 4. 回転を合成：(ワールド基準のタッチヨー) * (ジャイロの向き) * (ローカル基準のタッチピッチ)
			// この順序が最も安定し、意図通りの操作を実現する
			quaternion.copy(qTouchYaw).multiply(gyroQuaternion).multiply(qTouchPitch);

		};

		this.connect = function () {
			onScreenOrientationChangeEvent(); // run once on load

			// iOS 13+
			if (window.DeviceOrientationEvent !== undefined && typeof window.DeviceOrientationEvent.requestPermission === 'function') {

				window.DeviceOrientationEvent.requestPermission().then(function (response) {

					if (response == 'granted') {

						window.addEventListener('orientationchange', onScreenOrientationChangeEvent);
						window.addEventListener('deviceorientation', onDeviceOrientationChangeEvent);

					}

				}).catch(function (error) {

					console.error('THREE.DeviceOrientationControls: Unable to use DeviceOrientation API:', error);

				});

			} else {

				window.addEventListener('orientationchange', onScreenOrientationChangeEvent);
				window.addEventListener('deviceorientation', onDeviceOrientationChangeEvent);

			}

			scope.enabled = true;

		};

		this.disconnect = function () {

			window.removeEventListener('orientationchange', onScreenOrientationChangeEvent);
			window.removeEventListener('deviceorientation', onDeviceOrientationChangeEvent);

			scope.enabled = false;

		};

		this.update = function () {

			if (scope.enabled === false) return;

			const device = scope.deviceOrientation;

			if (device) {

				const alpha = (device.webkitCompassHeading !== undefined ? device.webkitCompassHeading : device.alpha) ? THREE.MathUtils.degToRad(device.webkitCompassHeading !== undefined ? device.webkitCompassHeading : device.alpha) + scope.alphaOffset : 0; // Z
				const beta = device.beta ? THREE.MathUtils.degToRad(device.beta) : 0; // X'
				const gamma = device.gamma ? THREE.MathUtils.degToRad(device.gamma) : 0; // Y''
				const orient = scope.screenOrientation ? THREE.MathUtils.degToRad(scope.screenOrientation) : 0; // O

				setObjectQuaternion(scope.object.quaternion, alpha, beta, gamma, orient);

				if (8 * (1 - lastQuaternion.dot(scope.object.quaternion)) > EPS) {

					lastQuaternion.copy(scope.object.quaternion);
					scope.dispatchEvent(_changeEvent);

				}

			}

		};

		this.dispose = function () {

			scope.disconnect();

		};
		
		this.resetView = function () {
			// タッチによるオフセットをリセット
			scope.touchYaw = 0;
			scope.touchPitch = 0;

			// ジャイロの基準となる向きも現在の向きにリセット
			const device = scope.deviceOrientation;
			if (device && (device.alpha || device.webkitCompassHeading)) {
				if (device.webkitCompassHeading) {
					scope.alphaOffset = -THREE.MathUtils.degToRad(device.webkitCompassHeading);
				} else {
					scope.alphaOffset = -THREE.MathUtils.degToRad(device.alpha);
				}
			}
		};

	}

}

export { DeviceOrientationControls };

