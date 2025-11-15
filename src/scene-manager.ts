/**
 * Three.jsシーン管理
 * Three.jsのシーン、カメラ、レンダラーを初期化・管理
 * CSS2DRendererを使用してHTML要素を3D空間に配置
 */

import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export class SceneManager {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private css2DRenderer: CSS2DRenderer;
  private container: HTMLElement;
  private animationFrameId: number | null = null;

  constructor(container: HTMLElement) {
    this.container = container;

    // シーンの作成
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1e1e2e);

    // カメラの作成
    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.z = 5;

    // WebGLレンダラーの作成
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    // CSS2Dレンダラーの作成（HTML要素を3D空間に配置）
    this.css2DRenderer = new CSS2DRenderer();
    this.css2DRenderer.setSize(container.clientWidth, container.clientHeight);
    this.css2DRenderer.domElement.style.position = 'absolute';
    this.css2DRenderer.domElement.style.top = '0';
    this.css2DRenderer.domElement.style.left = '0';
    this.css2DRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(this.css2DRenderer.domElement);

    // 簡単な照明を追加
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(5, 5, 5);
    this.scene.add(directionalLight);

    // ウィンドウリサイズイベント
    window.addEventListener('resize', this.onWindowResize);

    // アニメーションループ開始
    this.animate();
  }

  /**
   * HTML要素をシーンに追加
   */
  public addHTMLElement(element: HTMLElement, position: THREE.Vector3): CSS2DObject {
    const css2DObject = new CSS2DObject(element);
    css2DObject.position.copy(position);
    this.scene.add(css2DObject);
    return css2DObject;
  }

  /**
   * CSS2DObjectをシーンから削除
   */
  public removeHTMLElement(css2DObject: CSS2DObject): void {
    this.scene.remove(css2DObject);
  }

  /**
   * シーンを取得
   */
  public getScene(): THREE.Scene {
    return this.scene;
  }

  /**
   * カメラを取得
   */
  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  /**
   * CSS2Dレンダラーのコンテナを取得
   */
  public getCSS2DContainer(): HTMLElement {
    return this.css2DRenderer.domElement;
  }

  /**
   * ウィンドウリサイズ処理
   */
  private onWindowResize = (): void => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.css2DRenderer.setSize(width, height);
  };

  /**
   * アニメーションループ
   */
  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    // カメラをゆっくり回転（オプション）
    // this.camera.position.x = Math.sin(Date.now() * 0.0001) * 5;
    // this.camera.position.z = Math.cos(Date.now() * 0.0001) * 5;
    // this.camera.lookAt(0, 0, 0);

    this.renderer.render(this.scene, this.camera);
    this.css2DRenderer.render(this.scene, this.camera);
  };

  /**
   * クリーンアップ
   */
  public dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    window.removeEventListener('resize', this.onWindowResize);

    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
    this.container.removeChild(this.css2DRenderer.domElement);
  }
}

