// ★★★ 変更点: Three.js本体を完全なURLで直接インポート ★★★
import {
	Euler,
	EventDispatcher,
	MathUtils,
	Quaternion,
	Vector3
} from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const _zee = new Vector3(0, 0, 1);
const _euler = new Euler();
const _q0 = new Quaternion();
const _q1 = new Quaternion(- Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // - PI/2 around the x-axis

const _changeEvent = { type: 'change' };

class DeviceOrientationControls extends EventDispatcher {

	constructor(object) {

		super();

		if (window.isSecureContext === false) {
			console.error('THREE.DeviceOrientationControls: DeviceOrientationEvent is only available in secure contexts (https)');
		}

		const scope = this;

		const EPS = 0.000001;
		const lastQuaternion = new Quaternion();

		this.object = object;
		this.object.rotation.reorder('YXZ');

		this.enabled = true;

		this.deviceOrientation = {};
		this.screenOrientation = 0;

		this.alphaOffset = 0; // radians
		
		// For touch control
		this.touchYaw = 0;
		this.touchPitch = 0;


		const onDeviceOrientationChangeEvent = function (event) {
			scope.deviceOrientation = event;
		};

		const onScreenOrientationChangeEvent = function () {
			scope.screenOrientation = window.orientation || 0;
		};

		// The angles alpha, beta and gamma form a set of intrinsic Tait-Bryan angles of type Z-X'-Y''
		const setObjectQuaternion = function (quaternion, alpha, beta, gamma, orient) {
			_euler.set(beta, alpha, - gamma, 'YXZ'); // 'ZXY' for the device, but 'YXZ' for us
			quaternion.setFromEuler(_euler); // orient the device
			quaternion.multiply(_q1); // camera looks out the back of the device, not the top
			quaternion.multiply(_q0.setFromAxisAngle(_zee, - orient)); // adjust for screen orientation
		};

		this.connect = function () {

			onScreenOrientationChangeEvent(); // run once on load

			// First event listener to set the alphaOffset
			const onFirstDeviceOrientation = (event) => {
				if(event.alpha === null) return;
				
				// Set alphaOffset automatically based on the initial heading
				const heading = event.webkitCompassHeading || event.alpha;
				if(heading) {
					this.alphaOffset = -MathUtils.degToRad(heading);
				}
				
				// Replace this listener with the regular one
				window.removeEventListener('deviceorientation', onFirstDeviceOrientation);
				window.addEventListener('deviceorientation', onDeviceOrientationChangeEvent);
			};


			// iOS 13+
			if (window.DeviceOrientationEvent !== undefined && typeof window.DeviceOrientationEvent.requestPermission === 'function') {
				window.DeviceOrientationEvent.requestPermission().then(function (response) {
					if (response == 'granted') {
						window.addEventListener('orientationchange', onScreenOrientationChangeEvent);
						// Use the one-time listener to initialize the alpha offset
						window.addEventListener('deviceorientation', onFirstDeviceOrientation);
					}
				}).catch(function (error) {
					console.error('THREE.DeviceOrientationControls: Unable to use DeviceOrientation API:', error);
				});
			} else {
				window.addEventListener('orientationchange', onScreenOrientationChangeEvent);
				window.addEventListener('deviceorientation', onFirstDeviceOrientation);
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
				const alpha = device.alpha ? MathUtils.degToRad(device.alpha) + scope.alphaOffset : 0; // Z
				const beta = device.beta ? MathUtils.degToRad(device.beta) : 0; // X'
				const gamma = device.gamma ? MathUtils.degToRad(device.gamma) : 0; // Y''
				const orient = scope.screenOrientation ? MathUtils.degToRad(scope.screenOrientation) : 0; // O
				
				const gyroQuaternion = new Quaternion();
				setObjectQuaternion(gyroQuaternion, alpha, beta, gamma, orient);
				
				// Combine gyro with touch controls
				// 1. Yaw (left-right) rotation around the world's Y-axis
				const touchQuaternionYaw = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), this.touchYaw);
				
				// 2. Pitch (up-down) rotation around the local X-axis
				const touchQuaternionPitch = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), this.touchPitch);

				// Calculate final orientation: (Touch Yaw) * (Gyro) * (Touch Pitch)
				const finalQuaternion = new Quaternion()
					.multiply(touchQuaternionYaw)
					.multiply(gyroQuaternion)
					.multiply(touchQuaternionPitch);

				scope.object.quaternion.copy(finalQuaternion);

				if (8 * (1 - lastQuaternion.dot(scope.object.quaternion)) > EPS) {
					lastQuaternion.copy(scope.object.quaternion);
					scope.dispatchEvent(_changeEvent);
				}
			}
		};

		this.resetView = function () {
			this.touchYaw = 0;
			this.touchPitch = 0;
			// Reset alphaOffset based on the current device orientation
			const device = scope.deviceOrientation;
			if(device && device.alpha !== null) {
				this.alphaOffset = -MathUtils.degToRad(device.webkitCompassHeading || device.alpha);
			}
		};

		this.dispose = function () {
			scope.disconnect();
		};
	}
}

export { DeviceOrientationControls };

