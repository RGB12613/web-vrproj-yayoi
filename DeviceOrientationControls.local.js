// ★★★ 変更点: Three.js本体をimportmap経由で読み込むように修正 ★★★
import { Euler, EventDispatcher, MathUtils, Quaternion, Vector3 } from "three";

const _zee = new Vector3(0, 0, 1);
const _euler = new Euler();
const _q0 = new Quaternion();
const _q1 = new Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // - PI/2 around the x-axis

const _changeEvent = { type: "change" };

class DeviceOrientationControls extends EventDispatcher {
  constructor(object) {
    super();

    if (window.isSecureContext === false) {
      console.error(
        "THREE.DeviceOrientationControls: DeviceOrientationEvent is only available in secure contexts (https)"
      );
    }

    const scope = this;

    const EPS = 0.000001;
    const lastQuaternion = new Quaternion();

    this.object = object;
    this.object.rotation.reorder("YXZ");

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

    // The angles alpha, beta and gamma form a set of intrinsic Tait-Bryan angles of type Z-X'-Y''
    const setObjectQuaternion = function (
      quaternion,
      alpha,
      beta,
      gamma,
      orient
    ) {
      _euler.set(beta, alpha, -gamma, "YXZ"); // 'ZXY' for the device, but 'YXZ' for us
      quaternion.setFromEuler(_euler); // orient the device
      quaternion.multiply(_q1); // camera looks out the back of the device, not the top
      quaternion.multiply(_q0.setFromAxisAngle(_zee, -orient)); // adjust for screen orientation
    };

    this.connect = function () {
      console.log("controls.connect()が呼び出されました。"); // ★追加

      onScreenOrientationChangeEvent(); // run once on load

      const onFirstDeviceOrientation = (event) => {
        console.log("最初のジャイロイベントを検知しました。"); // ★追加
        if (event.alpha === null) return;
        const heading = event.webkitCompassHeading || event.alpha;
        if (heading) {
          this.alphaOffset = -MathUtils.degToRad(heading);
        }
        window.removeEventListener(
          "deviceorientation",
          onFirstDeviceOrientation
        );
        window.addEventListener(
          "deviceorientation",
          onDeviceOrientationChangeEvent
        );
      }; // iOS 13+

      if (
        window.DeviceOrientationEvent !== undefined &&
        typeof window.DeviceOrientationEvent.requestPermission === "function"
      ) {
        console.log("iOS 13+環境と判断。ジャイロの権限をリクエストします..."); // ★追加
        window.DeviceOrientationEvent.requestPermission()
          .then(function (response) {
            console.log("権限リクエストへの応答:", response); // ★追加
            if (response == "granted") {
              console.log(
                "権限が許可されました。イベントリスナーを追加します。"
              ); // ★追加
              window.addEventListener(
                "orientationchange",
                onScreenOrientationChangeEvent
              );
              window.addEventListener(
                "deviceorientation",
                onFirstDeviceOrientation
              );
            } else {
              console.warn("ジャイロの権限が許可されませんでした。"); // ★追加
            }
          })
          .catch(function (error) {
            console.error(
              "THREE.DeviceOrientationControls: Unable to use DeviceOrientation API:",
              error
            );
          });
      } else {
        console.log("非iOS環境と判断。イベントリスナーを直接追加します。"); // ★追加
        window.addEventListener(
          "orientationchange",
          onScreenOrientationChangeEvent
        );
        window.addEventListener("deviceorientation", onFirstDeviceOrientation);
      }

      scope.enabled = true;
    };

    this.disconnect = function () {
      window.removeEventListener(
        "orientationchange",
        onScreenOrientationChangeEvent
      );
      window.removeEventListener(
        "deviceorientation",
        onDeviceOrientationChangeEvent
      );
      scope.enabled = false;
    };

    this.update = function () {
      if (scope.enabled === false) return;

      const device = scope.deviceOrientation;

      if (device) {
        const alpha = device.alpha
          ? MathUtils.degToRad(device.alpha) + scope.alphaOffset
          : 0; // Z
        const beta = device.beta ? MathUtils.degToRad(device.beta) : 0; // X'
        const gamma = device.gamma ? MathUtils.degToRad(device.gamma) : 0; // Y''
        const orient = scope.screenOrientation
          ? MathUtils.degToRad(scope.screenOrientation)
          : 0; // O

        const gyroQuaternion = new Quaternion();
        setObjectQuaternion(gyroQuaternion, alpha, beta, gamma, orient);

        // ★★★ 変更点: タッチ操作の回転方向を反転させるため、符号を逆にする ★★★
        const touchQuaternionYaw = new Quaternion().setFromAxisAngle(
          new Vector3(0, 1, 0),
          -this.touchYaw
        );
        const touchQuaternionPitch = new Quaternion().setFromAxisAngle(
          new Vector3(1, 0, 0),
          -this.touchPitch
        );

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
      const device = scope.deviceOrientation;
      if (device && device.alpha !== null) {
        this.alphaOffset = -MathUtils.degToRad(
          device.webkitCompassHeading || device.alpha
        );
      }
    };

    this.dispose = function () {
      scope.disconnect();
    };
  }
}

export { DeviceOrientationControls };
