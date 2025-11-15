/**
 * Three.jsシーン管理
 * Three.jsのシーン、カメラ、レンダラーを初期化・管理
 * CSS2DRendererを使用してHTML要素を3D空間に配置
 */

import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FloatingWindowCSS2DService } from './floating-window-css2d.service';

export class SceneManager {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private css2DRenderer: CSS2DRenderer;
  private controls: OrbitControls;
  private container: HTMLElement;
  private animationFrameId: number | null = null;
  private floatingWindowCSS2DService: FloatingWindowCSS2DService;
  private resizeObserver: ResizeObserver | null = null;

  constructor(container: HTMLElement) {
    this.container = container;

    // シーンの作成
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x778C97);

    // カメラの作成
    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      10000
    );
    this.camera.position.set(0, 1200, 0); // XZ平面を俯瞰するため上空に配置
    this.camera.lookAt(0, 0, 0); // カメラを原点（XZ平面）に向ける
    this.camera.up.set(0, 0, -1); // Z軸負方向を上として設定

    // WebGLレンダラーの作成
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.top = '0';
    this.renderer.domElement.style.left = '0';
    this.renderer.domElement.style.zIndex = '0'; // 最下層に配置（OrbitControlsが動作するため）
    container.appendChild(this.renderer.domElement);

    // CSS2Dレンダラーの作成（HTML要素を3D空間に配置）
    this.css2DRenderer = new CSS2DRenderer();
    this.css2DRenderer.setSize(container.clientWidth, container.clientHeight);
    this.css2DRenderer.domElement.style.position = 'absolute';
    this.css2DRenderer.domElement.style.top = '0';
    this.css2DRenderer.domElement.style.left = '0';
    this.css2DRenderer.domElement.style.pointerEvents = 'none';
    this.css2DRenderer.domElement.style.zIndex = '1'; // WebGLレンダラーより上、フローティングウィンドウより下
    container.appendChild(this.css2DRenderer.domElement);

    // フローティングウィンドウCSS2Dサービスを初期化
    this.floatingWindowCSS2DService = new FloatingWindowCSS2DService();
    this.floatingWindowCSS2DService.initializeWithRenderer(this.css2DRenderer);
    this.floatingWindowCSS2DService.attachToScene(this.scene);

    // OrbitControlsの初期化
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enableRotate = false;
    // 左クリックにも pan を割り当て
    this.controls.mouseButtons.LEFT = THREE.MOUSE.PAN;

    // 簡単な照明を追加
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(5, 5, 5);
    this.scene.add(directionalLight);

    // ウィンドウリサイズイベント
    window.addEventListener('resize', this.onWindowResize);

    // ResizeObserverでコンテナのサイズ変更を監視（サイドバーの表示/非表示に対応）
    this.resizeObserver = new ResizeObserver(() => {
      this.onWindowResize();
    });
    this.resizeObserver.observe(container);

    // アニメーションループ開始
    this.animate();
  }

  /**
   * フローティングウィンドウコンテナを取得
   * Reactコンポーネントがこのコンテナにウィンドウを追加できるようにする
   */
  public getFloatingContainer(): HTMLDivElement | undefined {
    return this.floatingWindowCSS2DService?.getFloatingContainer();
  }

  /**
   * フローティングウィンドウCSS2Dサービスを取得
   */
  public getFloatingWindowCSS2DService(): FloatingWindowCSS2DService {
    return this.floatingWindowCSS2DService;
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
    this.floatingWindowCSS2DService.setSize(width, height);
  };

  /**
   * アニメーションループ
   */
  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    // OrbitControlsを更新
    this.controls.update();

    this.renderer.render(this.scene, this.camera);
    // CSS2DRendererのレンダリングはサービス経由で行う
    this.floatingWindowCSS2DService.render(this.scene, this.camera);
  };

  /**
   * クリーンアップ
   */
  public dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    window.removeEventListener('resize', this.onWindowResize);

    // ResizeObserverをクリーンアップ
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // フローティングウィンドウCSS2Dサービスをクリーンアップ
    if (this.floatingWindowCSS2DService) {
      this.floatingWindowCSS2DService.dispose();
    }

    if (this.controls) {
      this.controls.dispose();
    }

    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
    this.container.removeChild(this.css2DRenderer.domElement);
  }
}

