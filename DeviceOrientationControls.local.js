// This file is adapted from a specific commit in the three.js repository:
// https://github.com/mrdoob/three.js/pull/22654/commits/23dc9e9918ecee21d4bbe5d038a8d16f82dc389f
// And enhanced with cross-platform compatibility techniques from:
// https://qiita.com/hoto17296/items/9b6111acf384e721cf04
// And modified to support touch-based rotation offsets.

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
const _touchQuaternion = new Quaternion(); // ★★★ 変更点: タッチ回転用クォータニオンを追加 ★★★

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
        
        // ★★★ 変更点: タッチ操作による回転オフセットを保持するEuler角を追加 ★★★
        this.touchEuler = new Euler( 0, 0, 0, 'YXZ' );

		const onDeviceOrientationChangeEvent = function ( event ) {
			scope.deviceOrientation = event;
		};

		const onScreenOrientationChangeEvent = function () {
			scope.screenOrientation = window.orientation || 0;
		};
        
        const onFirstDeviceOrientation = function ( event ) {
            const alpha = event.webkitCompassHeading !== undefined ? event.webkitCompassHeading : event.alpha;
            if ( alpha !== null ) {
                scope.alphaOffset = - MathUtils.degToRad( alpha );
                window.removeEventListener( 'deviceorientation', onFirstDeviceOrientation );
            }
        };


		const setObjectQuaternion = function ( quaternion, alpha, beta, gamma, orient ) {
			_euler.set( beta, alpha, - gamma, 'YXZ' ); 
			quaternion.setFromEuler( _euler ); 
			quaternion.multiply( _q1 ); 
			quaternion.multiply( _q0.setFromAxisAngle( _zee, - orient ) );
		};

		this.connect = function () {
			onScreenOrientationChangeEvent(); 
            window.addEventListener( 'deviceorientation', onFirstDeviceOrientation );

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
				
                // 1. ジャイロから基本の向きを設定
                setObjectQuaternion( scope.object.quaternion, alpha, beta, gamma, orient );
                
                // ★★★ 変更点: タッチによる回転を追加で合成 ★★★
                _touchQuaternion.setFromEuler( scope.touchEuler );
                scope.object.quaternion.multiply( _touchQuaternion );

				if ( 8 * ( 1 - lastQuaternion.dot( scope.object.quaternion ) ) > EPS ) {
					lastQuaternion.copy( scope.object.quaternion );
					scope.dispatchEvent( _changeEvent );
				}
			}
		};

		this.dispose = function () {
			scope.disconnect();
		};
	}
}

export { DeviceOrientationControls };

