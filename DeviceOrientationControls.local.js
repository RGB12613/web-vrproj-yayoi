// This file is adapted from a specific commit in the three.js repository:
// https://github.com/mrdoob/three.js/pull/22654/commits/23dc9e9918ecee21d4bbe5d038a8d16f82dc389f
// And enhanced with cross-platform compatibility techniques from:
// https://qiita.com/hoto17296/items/9b6111acf384e721cf04

import {
	Euler,
	EventDispatcher,
	MathUtils,
	Quaternion,
	Vector3
} from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const _zee = new Vector3( 0, 0, 1 );
const _euler = new Euler();
const _q0 = new Quaternion();
const _q1 = new Quaternion( - Math.sqrt( 0.5 ), 0, 0, Math.sqrt( 0.5 ) ); // - PI/2 around the x-axis

const _changeEvent = { type: 'change' };

class DeviceOrientationControls extends EventDispatcher {

	constructor( object ) {

		super();

		if ( window.isSecureContext === false ) {
			console.error( 'THREE.DeviceOrientationControls: DeviceOrientationEvent is only available in secure contexts (https)' );
		}

		const scope = this;
		const EPS = 0.000001;
		const lastQuaternion = new Quaternion();

		this.object = object;
		this.object.rotation.reorder( 'YXZ' );

		this.enabled = true;

		this.deviceOrientation = {};
		this.screenOrientation = 0;
		this.alphaOffset = 0; // radians

		const onDeviceOrientationChangeEvent = function ( event ) {
			scope.deviceOrientation = event;
		};

		const onScreenOrientationChangeEvent = function () {
			scope.screenOrientation = window.orientation || 0;
		};
        
        // ★★★ 変更点: 初回起動時の向きを自動補正する処理 ★★★
        const onFirstDeviceOrientation = function ( event ) {
            // iOSではwebkitCompassHeadingを優先し、それ以外はalphaを使用
            const alpha = event.webkitCompassHeading !== undefined ? event.webkitCompassHeading : event.alpha;
            if ( alpha !== null ) {
                // 現在の方位を打ち消すオフセットを設定
                scope.alphaOffset = - MathUtils.degToRad( alpha );
                // このリスナーは初回のみ実行するため、ここで削除
                window.removeEventListener( 'deviceorientation', onFirstDeviceOrientation );
            }
        };


		const setObjectQuaternion = function ( quaternion, alpha, beta, gamma, orient ) {
			_euler.set( beta, alpha, - gamma, 'YXZ' ); // 'ZXY' for the device, but 'YXZ' for us
			quaternion.setFromEuler( _euler ); // orient the device
			quaternion.multiply( _q1 ); // camera looks out the back of the device, not the top
			quaternion.multiply( _q0.setFromAxisAngle( _zee, - orient ) ); // adjust for screen orientation
		};

		this.connect = function () {
			onScreenOrientationChangeEvent(); // run once on load
            
            // ★★★ 変更点: 初回補正用のリスナーを登録 ★★★
            window.addEventListener( 'deviceorientation', onFirstDeviceOrientation );

			// iOS 13+
			if ( window.DeviceOrientationEvent !== undefined && typeof window.DeviceOrientationEvent.requestPermission === 'function' ) {
				window.DeviceOrientationEvent.requestPermission().then( function ( response ) {
					if ( response == 'granted' ) {
						window.addEventListener( 'orientationchange', onScreenOrientationChangeEvent );
						window.addEventListener( 'deviceorientation', onDeviceOrientationChangeEvent );
					}
				} ).catch( function ( error ) {
					console.error( 'THREE.DeviceOrientationControls: Unable to use DeviceOrientation API:', error );
				} );
			} else {
				window.addEventListener( 'orientationchange', onScreenOrientationChangeEvent );
				window.addEventListener( 'deviceorientation', onDeviceOrientationChangeEvent );
			}
			scope.enabled = true;
		};

		this.disconnect = function () {
            // ★★★ 変更点: 初回補正用リスナーも削除対象に追加 ★★★
            window.removeEventListener( 'deviceorientation', onFirstDeviceOrientation );
			window.removeEventListener( 'orientationchange', onScreenOrientationChangeEvent );
			window.removeEventListener( 'deviceorientation', onDeviceOrientationChangeEvent );
			scope.enabled = false;
		};

		this.update = function () {
			if ( scope.enabled === false ) return;
			const device = scope.deviceOrientation;
			if ( device ) {
				const alpha = device.alpha ? MathUtils.degToRad( device.alpha ) + scope.alphaOffset : 0; // Z
				const beta = device.beta ? MathUtils.degToRad( device.beta ) : 0; // X'
				const gamma = device.gamma ? MathUtils.degToRad( device.gamma ) : 0; // Y''
				const orient = scope.screenOrientation ? MathUtils.degToRad( scope.screenOrientation ) : 0; // O
				setObjectQuaternion( scope.object.quaternion, alpha, beta, gamma, orient );
				if ( 8 * ( 1 - lastQuaternion.dot( scope.object.quaternion ) ) > EPS ) {
					lastQuaternion.copy( scope.object.quaternion );
					scope.dispatchEvent( _changeEvent );
				}
			}
		};

		this.dispose = function () {
			scope.disconnect();
		};

        // ★★★ 変更点: コンストラクタでの自動接続を削除 ★★★
		// this.connect();
	}
}

export { DeviceOrientationControls };

