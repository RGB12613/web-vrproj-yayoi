import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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
     */
    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 0).normalize();
        this.scene.add(directionalLight);
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
