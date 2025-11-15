/**
 * FloatingWindowCSS2DService
 * 
 * 【役割】
 * - フローティングウィンドウとThree.jsのCSS2Dレンダリングの統合を担当
 * - DOM要素をCSS2DObjectとして3D空間に配置
 * - CSS2DRendererのライフサイクル管理
 * 
 * 【責務の境界】
 * - CSS2Dレンダリングの初期化とレンダリング
 * - フローティングウィンドウコンテナの3D空間への配置
 * - レンダラーのリサイズとクリーンアップ
 */

import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export class FloatingWindowCSS2DService {
  private css2DRenderer?: CSS2DRenderer;
  private css2DObject?: CSS2DObject;
  private hostElement?: HTMLElement;
  private floatingContainer?: HTMLDivElement;
  private isContainerVisible = true;
  
  // スケール計算用の設定
  private baseDistance: number | null = null; // 基準距離（起動時の距離で初期化）
  private readonly MIN_SCALE = 0.1; // 最小スケール
  private readonly MAX_SCALE = 5.0; // 最大スケール

  /**
   * CSS2DRendererとフローティングウィンドウコンテナを初期化します
   * 
   * @param hostElement レンダラーを配置する親要素
   * @param width レンダラーの幅
   * @param height レンダラーの高さ
   */
  initializeRenderer(hostElement: HTMLElement, width: number, height: number): CSS2DRenderer {
    this.dispose();

    this.hostElement = hostElement;
    this.css2DRenderer = new CSS2DRenderer();
    this.css2DRenderer.setSize(width, height);
    
    // CSS2DRendererのスタイル設定
    const rendererElement = this.css2DRenderer.domElement;
    rendererElement.style.position = 'absolute';
    rendererElement.style.top = '0';
    rendererElement.style.left = '0';
    rendererElement.style.pointerEvents = 'none';
    rendererElement.style.zIndex = '10';
    
    hostElement.appendChild(rendererElement);

    // フローティングウィンドウコンテナを作成
    this.createFloatingContainer();
    this.applyContainerVisibility();

    return this.css2DRenderer;
  }

  /**
   * 既存のCSS2DRendererを使用して初期化します
   * 
   * @param css2DRenderer 既存のCSS2DRenderer
   */
  initializeWithRenderer(css2DRenderer: CSS2DRenderer): void {
    this.css2DRenderer = css2DRenderer;
    this.createFloatingContainer();
    this.applyContainerVisibility();
  }

  /**
   * フローティングウィンドウコンテナDOM要素を作成します
   * 
   * このメソッドは内部的に呼ばれ、
   * .floating-windows-container要素を動的に生成します。
   */
  private createFloatingContainer(): HTMLDivElement {
    if (this.floatingContainer) {
      this.applyContainerVisibility();
      return this.floatingContainer;
    }

    const container = document.createElement('div');
    container.className = 'floating-windows-container';
    
    // CSSスタイルをインラインで設定
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '0';
    container.style.height = '0';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '100';

    // 子要素のpointer-eventsを有効化するためのスタイルを追加
    const style = document.createElement('style');
    style.textContent = `
      .floating-windows-container > * {
        pointer-events: all;
      }
    `;
    document.head.appendChild(style);

    this.floatingContainer = container;
    this.applyContainerVisibility();
    
    return container;
  }

  /**
   * フローティングウィンドウコンテナを取得します
   * 
   * Reactコンポーネントがウィンドウコンポーネントを
   * このコンテナに追加できるようにします。
   */
  getFloatingContainer(): HTMLDivElement | undefined {
    return this.floatingContainer;
  }

  /**
   * フローティングウィンドウコンテナを3D空間に配置します
   * 
   * @param scene Three.jsのシーン
   * @param position 3D空間での配置位置（デフォルト: (0, 20, -100)）
   */
  attachToScene(
    scene: THREE.Scene,
    position: THREE.Vector3 = new THREE.Vector3(0, 20, -100)
  ): CSS2DObject | null {
    if (!this.floatingContainer) {
      console.warn('Floating container is not created. Call initializeRenderer() or initializeWithRenderer() first.');
      return null;
    }

    return this.attachFloatingWindowContainer(this.floatingContainer, scene, position);
  }

  /**
   * フローティングウィンドウコンテナをCSS2DObjectとして3D空間に配置します
   * 
   * @param containerElement フローティングウィンドウコンテナのDOM要素
   * @param scene Three.jsのシーン
   * @param position 3D空間での配置位置（デフォルト: (0, 20, -100)）
   */
  private attachFloatingWindowContainer(
    containerElement: HTMLElement,
    scene: THREE.Scene,
    position: THREE.Vector3 = new THREE.Vector3(0, 20, -100)
  ): CSS2DObject {
    // 既存のオブジェクトを削除
    if (this.css2DObject && this.css2DObject.parent) {
      this.css2DObject.parent.remove(this.css2DObject);
    }

    // DOM要素のpointer-eventsを有効化
    containerElement.style.pointerEvents = 'auto';

    // CSS2DObjectを作成
    this.css2DObject = new CSS2DObject(containerElement);
    this.css2DObject.position.copy(position);
    this.css2DObject.scale.set(1, 1, 1);

    // シーンに追加
    scene.add(this.css2DObject);

    return this.css2DObject;
  }

  /**
   * カメラからの距離に基づいてスケール値を計算します
   * 
   * @param distance カメラからCSS2Dオブジェクトまでの距離
   * @returns クランプされたスケール値（MIN_SCALE～MAX_SCALE）
   */
  private calculateScale(distance: number): number {
    if (distance <= 0) {
      return this.MAX_SCALE;
    }
    
    // 基準距離が設定されていない場合は、現在の距離を基準距離として使用
    if (this.baseDistance === null) {
      this.baseDistance = 1000; // 基準距離を1000に設定
    }
    
    // スケール = 基準距離 / 現在の距離
    // 起動時（基準距離 = 現在の距離）の場合はスケール1になる
    const scale = this.baseDistance / distance;
    
    // スケールを MIN_SCALE ~ MAX_SCALE の範囲にクランプ
    return Math.max(this.MIN_SCALE, Math.min(this.MAX_SCALE, scale));
  }

  /**
   * フローティングコンテナのスケールを更新します
   * 
   * @param camera Three.jsのカメラ
   */
  private updateContainerScale(camera: THREE.PerspectiveCamera): void {
    if (!this.floatingContainer || !this.css2DObject) {
      return;
    }

    // カメラとCSS2Dオブジェクトの3D空間での位置を取得
    const cameraPosition = camera.position;
    const objectPosition = new THREE.Vector3();
    this.css2DObject.getWorldPosition(objectPosition);

    // 距離を計算（y方向のみ）
    const distance = Math.abs(cameraPosition.y - objectPosition.y);

    // スケールを計算
    const scale = this.calculateScale(distance);

    // CSS2DRendererが設定した既存のtransformを取得
    const existingTransform = this.floatingContainer.style.transform || '';
    
    // 既存のtransformからscale()を削除（既に存在する場合）
    // scale()が既にある場合は、それを新しい値で置き換える
    let cleanedTransform = existingTransform.replace(/\s*scale\([^)]*\)/gi, '');
    
    // 既存のtransformにscale()を追加
    // transformの順序: 既存のtransform（translateなど）の後にscale()を適用
    const newTransform = cleanedTransform.trim() 
      ? `${cleanedTransform.trim()} scale(${scale})`
      : `scale(${scale})`;
    
    // DOM要素のtransformスタイルを更新
    this.floatingContainer.style.transform = newTransform;
    this.floatingContainer.style.transformOrigin = 'top left';
  }

  /**
   * CSS2Dシーンをレンダリングします
   * 
   * @param scene Three.jsのシーン
   * @param camera Three.jsのカメラ
   */
  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    if (!this.css2DRenderer) {
      return;
    }
    
    // CSS2DRendererのrender()を先に実行（これがtransformを設定する）
    this.css2DRenderer.render(scene, camera);
    
    // CSS2DRendererのrender()の後にscaleを適用
    // これにより、CSS2DRendererが設定したtransformに対してscaleを追加できる
    this.updateContainerScale(camera);
  }

  /**
   * レンダラーのサイズを変更します
   * 
   * @param width 新しい幅
   * @param height 新しい高さ
   */
  setSize(width: number, height: number): void {
    if (this.css2DRenderer) {
      this.css2DRenderer.setSize(width, height);
    }
  }

  /**
   * CSS2DObjectを取得します
   */
  getCSS2DObject(): CSS2DObject | undefined {
    return this.css2DObject;
  }

  /**
   * CSS2DRendererを取得します
   */
  getRenderer(): CSS2DRenderer | undefined {
    return this.css2DRenderer;
  }

  /**
   * リソースをクリーンアップします
   */
  dispose(): void {
    // CSS2DObjectをシーンから削除
    if (this.css2DObject && this.css2DObject.parent) {
      this.css2DObject.parent.remove(this.css2DObject);
    }
    this.css2DObject = undefined;

    // フローティングコンテナを削除
    if (this.floatingContainer) {
      // コンテナ内の子要素をすべて削除
      while (this.floatingContainer.firstChild) {
        this.floatingContainer.removeChild(this.floatingContainer.firstChild);
      }
      // コンテナ自体を削除（親要素がある場合）
      if (this.floatingContainer.parentElement) {
        this.floatingContainer.parentElement.removeChild(this.floatingContainer);
      }
      this.floatingContainer = undefined;
    }

    // CSS2DRendererのDOMを削除（独自に作成した場合のみ）
    if (this.css2DRenderer && this.hostElement) {
      const element = this.css2DRenderer.domElement;
      if (element && element.parentElement) {
        element.parentElement.removeChild(element);
      }
    }
    // CSS2DRendererは外部で管理されている可能性があるため、参照のみクリア
    this.css2DRenderer = undefined;

    this.hostElement = undefined;
    
    // 基準距離をリセット
    this.baseDistance = null;
  }

  /**
   * CSS2Dレンダリングが初期化されているかチェックします
   */
  isInitialized(): boolean {
    return !!this.css2DRenderer && !!this.floatingContainer;
  }

  /**
   * 現在のスケール値を取得します
   * 
   * @returns 現在のスケール値（取得できない場合は1.0）
   */
  getCurrentScale(): number {
    if (!this.floatingContainer) {
      return 1.0;
    }

    // transformスタイルからscale値を抽出
    const transform = this.floatingContainer.style.transform || '';
    const scaleMatch = transform.match(/scale\(([^)]+)\)/);
    
    if (scaleMatch && scaleMatch[1]) {
      const scaleValue = parseFloat(scaleMatch[1].trim());
      return isNaN(scaleValue) ? 1.0 : scaleValue;
    }

    // scaleが見つからない場合は1.0を返す
    return 1.0;
  }

  /**
   * フローティングウィンドウコンテナを非表示にします
   */
  hideFloatingContainer(): void {
    this.isContainerVisible = false;
    this.applyContainerVisibility();
  }

  /**
   * フローティングウィンドウコンテナを表示します
   */
  showFloatingContainer(): void {
    this.isContainerVisible = true;
    this.applyContainerVisibility();
  }

  /**
   * フローティングウィンドウコンテナとレンダラーDOM要素の表示状態を反映します
   */
  private applyContainerVisibility(): void {
    const displayValue = this.isContainerVisible ? '' : 'none';

    if (this.floatingContainer) {
      this.floatingContainer.style.display = displayValue;
    }
  }
}

