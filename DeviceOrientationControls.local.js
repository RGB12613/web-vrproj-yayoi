import { Euler, EventDispatcher, MathUtils, Quaternion, Vector3 } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

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
        
        this.touchYaw = 0;
        this.touchPitch = 0;

		const onDeviceOrientationChangeEvent = function (event) {
			scope.deviceOrientation = event;
		};

		const onScreenOrientationChangeEvent = function () {
			scope.screenOrientation = window.orientation || 0;
		};

        const setAlphaOffsetToCurrent = function (event) {
            if (event.alpha !== null) {
                const alpha = event.webkitCompassHeading ? MathUtils.degToRad(event.webkitCompassHeading) : MathUtils.degToRad(event.alpha);
                scope.alphaOffset = -alpha;
            }
             window.removeEventListener('deviceorientation', setAlphaOffsetToCurrent);
        };

		const setObjectQuaternion = function (quaternion, alpha, beta, gamma, orient) {
			// ★★★ 変更点: ジャイロのヨー(左右)方向を反転させるため、alphaを-alphaに変更 ★★★
			_euler.set(beta, -alpha, - gamma, 'YXZ'); // 'ZXY' for the device, but 'YXZ' for us
			quaternion.setFromEuler(_euler); // orient the device
			quaternion.multiply(_q1); // camera looks out the back of the device, not the top
			quaternion.multiply(_q0.setFromAxisAngle(_zee, - orient)); // adjust for screen orientation

			// ★★★ 変更点: タッチ操作のヨー(左右)方向を反転させるため、-scope.touchYawに変更 ★★★
            const touchRotationYaw = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -scope.touchYaw);
            const touchRotationPitch = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), scope.touchPitch);
            quaternion.multiply(touchRotationYaw).multiply(touchRotationPitch);
		};

		this.connect = function () {
			onScreenOrientationChangeEvent(); // run once on load
			
            if (window.DeviceOrientationEvent !== undefined && typeof window.DeviceOrientationEvent.requestPermission === 'function') {
				window.DeviceOrientationEvent.requestPermission().then(function (response) {
					if (response == 'granted') {
						window.addEventListener('orientationchange', onScreenOrientationChangeEvent);
						window.addEventListener('deviceorientation', onDeviceOrientationChangeEvent);
                        window.addEventListener('deviceorientation', setAlphaOffsetToCurrent);
					}
				}).catch(function (error) {
					console.error('THREE.DeviceOrientationControls: Unable to use DeviceOrientation API:', error);
				});
			} else {
				window.addEventListener('orientationchange', onScreenOrientationChangeEvent);
				window.addEventListener('deviceorientation', onDeviceOrientationChangeEvent);
                window.addEventListener('deviceorientation', setAlphaOffsetToCurrent);
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
                const alpha = device.webkitCompassHeading ? MathUtils.degToRad(device.webkitCompassHeading) : (device.alpha ? MathUtils.degToRad(device.alpha) : 0);
				const beta = device.beta ? MathUtils.degToRad(device.beta) : 0; // X'
				const gamma = device.gamma ? MathUtils.degToRad(device.gamma) : 0; // Y''
				const orient = scope.screenOrientation ? MathUtils.degToRad(scope.screenOrientation) : 0; // O

				setObjectQuaternion(scope.object.quaternion, alpha + scope.alphaOffset, beta, gamma, orient);

				if (8 * (1 - lastQuaternion.dot(scope.object.quaternion)) > EPS) {
					lastQuaternion.copy(scope.object.quaternion);
					scope.dispatchEvent(_changeEvent);
				}
			}
		};

        // ★★★ 変更点: 視点リセット用のメソッドを追加 ★★★
        this.resetView = function () {
            // タッチによるオフセットをリセット
            scope.touchYaw = 0;
            scope.touchPitch = 0;

            // ジャイロのオフセットをリセット
            if (scope.deviceOrientation) {
                const alpha = scope.deviceOrientation.webkitCompassHeading ? MathUtils.degToRad(scope.deviceOrientation.webkitCompassHeading) : (scope.deviceOrientation.alpha ? MathUtils.degToRad(scope.deviceOrientation.alpha) : 0);
                scope.alphaOffset = -alpha;
            }
        };

		this.dispose = function () {
			scope.disconnect();
		};
	}
}

export { DeviceOrientationControls };

