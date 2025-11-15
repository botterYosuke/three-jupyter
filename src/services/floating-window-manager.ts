/**
 * フローティングウィンドウマネージャー
 * ウィンドウの作成、削除、位置・サイズ管理を担当
 */

export type WindowType = 'editor' | 'output' | 'markdown';

export interface FloatingWindow {
  id: string;
  type: WindowType;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  isMinimized: boolean;
  content: string;
  linkedWindowId?: string; // エディタウィンドウと出力ウィンドウの紐付け
}

type WindowChangeListener = (windows: FloatingWindow[]) => void;

export class FloatingWindowManager {
  private windows: Map<string, FloatingWindow> = new Map();
  private nextId = 1;
  private maxZIndex = 1000;
  private listeners: Set<WindowChangeListener> = new Set();

  /**
   * ウィンドウ変更リスナーを登録
   */
  public addListener(listener: WindowChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * リスナーに変更を通知
   */
  private notifyListeners(): void {
    const windowList = Array.from(this.windows.values());
    this.listeners.forEach(listener => listener(windowList));
  }

  /**
   * 新しいウィンドウを作成
   */
  public createWindow(
    type: WindowType,
    title: string = 'Untitled',
    content: string = '',
    linkedWindowId?: string
  ): string {
    const id = `window-${this.nextId++}`;
    
    const defaultWidth = type === 'output' ? 800 : 700;
    const defaultHeight = type === 'output' ? 600 : 600;
    
    const offsetMultiplier = this.windows.size;
    
    const newWindow: FloatingWindow = {
      id,
      type,
      title,
      x: 100 + (offsetMultiplier * 30),
      y: 100 + (offsetMultiplier * 30),
      width: defaultWidth,
      height: defaultHeight,
      zIndex: ++this.maxZIndex,
      isMinimized: false,
      content,
      linkedWindowId
    };

    this.windows.set(id, newWindow);
    this.notifyListeners();
    return id;
  }

  /**
   * ウィンドウを閉じる
   */
  public closeWindow(id: string): void {
    const window = this.windows.get(id);
    if (!window) return;

    // エディタウィンドウを閉じる場合、リンクされた出力ウィンドウも閉じる
    if (window.type === 'editor') {
      const linkedWindows = Array.from(this.windows.values()).filter(
        w => w.linkedWindowId === id
      );
      linkedWindows.forEach(w => this.windows.delete(w.id));
    }

    this.windows.delete(id);
    this.notifyListeners();
  }

  /**
   * ウィンドウを最小化/復元
   */
  public minimizeWindow(id: string): void {
    const window = this.windows.get(id);
    if (!window) return;

    window.isMinimized = !window.isMinimized;
    this.notifyListeners();
  }

  /**
   * ウィンドウを最前面に移動
   */
  public bringToFront(id: string): void {
    const window = this.windows.get(id);
    if (!window) return;

    window.zIndex = ++this.maxZIndex;
    this.notifyListeners();
  }

  /**
   * ウィンドウの位置を更新
   */
  public updatePosition(id: string, x: number, y: number): void {
    const window = this.windows.get(id);
    if (!window) return;

    window.x = x;
    window.y = y;
    this.notifyListeners();
  }

  /**
   * ウィンドウのサイズを更新
   */
  public updateSize(id: string, width: number, height: number): void {
    const window = this.windows.get(id);
    if (!window) return;

    window.width = width;
    window.height = height;
    this.notifyListeners();
  }

  /**
   * ウィンドウのコンテンツを更新
   */
  public updateContent(id: string, content: string): void {
    const window = this.windows.get(id);
    if (!window) return;

    window.content = content;
    this.notifyListeners();
  }

  /**
   * ウィンドウのタイトルを更新
   */
  public updateTitle(id: string, title: string): void {
    const window = this.windows.get(id);
    if (!window) return;

    window.title = title;
    this.notifyListeners();
  }

  /**
   * ウィンドウを取得
   */
  public getWindow(id: string): FloatingWindow | undefined {
    return this.windows.get(id);
  }

  /**
   * 全てのウィンドウを取得
   */
  public getAllWindows(): FloatingWindow[] {
    return Array.from(this.windows.values());
  }

  /**
   * 全てのウィンドウをクリア
   */
  public clearAllWindows(): void {
    this.windows.clear();
    this.notifyListeners();
  }
}

