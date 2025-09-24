import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// ★★★ 変更点: Waterアドオンをインポート ★★★
import { Water } from 'three/addons/objects/Water.js';

/**
 * 3Dシーンのセットアップとアセットの読み込みを管理するクラスです。
 */
class SceneManager {
    /**
     * @param {THREE.Scene} scene 操作対象のThree.jsシーンオブジェクト
     */
    constructor(scene) {
        this.scene = scene;
        this.loader = new GLTFLoader();
    }

    /**
     * シーンに基本的なライトを追加します。
     * @returns {THREE.DirectionalLight} 方向性ライトの参照
     */
    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 0).normalize();
        this.scene.add(directionalLight);
        // ★★★ 変更点: ライトの参照を返す ★★★
        return directionalLight;
    }

    /**
     * 指定された範囲に水面オブジェクトを作成し、シーンに追加します。
     * @param {THREE.DirectionalLight} sun 太陽光として扱うライト
     * @returns {Water} 作成された水面オブジェクト
     */
    createWater(sun) {
        // 水面の大きさ
        const waterGeometry = new THREE.PlaneGeometry(100, 100);

        const water = new Water(
            waterGeometry,
            {
                textureWidth: 512,
                textureHeight: 512,
                // 水面の法線マップ（波の表現）
                waterNormals: new THREE.TextureLoader().load('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/textures/waternormals.jpg', function (texture) {
                    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                }),
                // 太陽光の向きと色を水面の反射に利用
                sunDirection: sun.position.clone().normalize(),
                sunColor: 0xffffff,
                waterColor: 0x001e0f,
                distortionScale: 3.7,
                fog: this.scene.fog !== undefined
            }
        );

        // 水面は水平に配置
        water.rotation.x = -Math.PI / 2;
        // Y=0の位置に配置（必要に応じて調整してください）
        water.position.y = 0;

        this.scene.add(water);
        return water;
    }


    /**
     * 指定されたURLからGLBモデルを非同期で読み込み、シーンに追加します。
     * @param {string} url モデルファイルのURL
     * @param {function} onProgress 読み込み進捗を処理するコールバック関数
     * @param {function} onLoad 読み込み完了を処理するコールバック関数
     * @param {function} onError 読み込みエラーを処理するコールバック関数
     */
    loadModel(url, onProgress, onLoad, onError) {
        this.loader.load(
            url,
            (gltf) => {
                // 深度の問題を解決するため、全マテリアルを強制的に不透明として扱う
                gltf.scene.traverse((object) => {
                    if (object.isMesh && object.material) {
                        object.material.transparent = false;
                        object.material.depthWrite = true;
                    }
                });
                this.scene.add(gltf.scene);
                onLoad(gltf); // 読み込み完了を呼び出し元に通知
            },
            onProgress,
            onError
        );
    }
}

export { SceneManager };

