import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { KernelManager, Kernel } from '@jupyterlab/services';
import { ReactWidget } from '@jupyterlab/apputils';
import { SceneManager } from '../services/scene-manager';
import { FloatingWindowManager } from '../services/floating-window-manager';
import { FloatingEditorWindow } from './floating-editor-window';
import { FloatingOutputWindow } from './floating-output-window';
import { FloatingMarkdownWindow } from './floating-markdown-window';

interface ThreeJupyterProps {}

const ThreeJupyterComponent: React.FC<ThreeJupyterProps> = () => {
  const [isKernelReady, setIsKernelReady] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [windows, setWindows] = useState<any[]>([]);
  const [floatingContainer, setFloatingContainer] = useState<HTMLDivElement | null>(null);
  const [outputContainer, setOutputContainer] = useState<HTMLDivElement | null>(null);
  
  const kernelRef = useRef<Kernel.IKernelConnection | null>(null);
  const kernelManagerRef = useRef<KernelManager | null>(null);
  const sceneManagerRef = useRef<SceneManager | null>(null);
  const windowManagerRef = useRef<FloatingWindowManager | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const initializationAttemptedRef = useRef<boolean>(false);

  useEffect(() => {
    // 少し遅延させてから初期化
    const initTimer = setTimeout(() => {
      if (!initializationAttemptedRef.current) {
        initializationAttemptedRef.current = true;
        initializeScene();
        startKernel();
      }
    }, 1000);

    return () => {
      clearTimeout(initTimer);
      cleanUp();
    };
  }, []);

  /**
   * Three.jsシーンを初期化
   */
  const initializeScene = () => {
    if (!containerRef.current || sceneManagerRef.current) return;

    try {
      sceneManagerRef.current = new SceneManager(containerRef.current);
      
      // フローティングウィンドウコンテナを取得
      const container = sceneManagerRef.current.getFloatingContainer();
      if (container) {
        setFloatingContainer(container);
      }
      
      // 出力ウィンドウコンテナを取得
      const outputContainer = sceneManagerRef.current.getOutputContainer();
      if (outputContainer) {
        setOutputContainer(outputContainer);
      }
      
      // ウィンドウマネージャーを初期化
      windowManagerRef.current = new FloatingWindowManager();
      
      // ウィンドウ変更リスナーを登録
      windowManagerRef.current.addListener((updatedWindows) => {
        setWindows(updatedWindows);
      });

      console.log('Three.js scene initialized');
    } catch (err) {
      console.error('Scene initialization error:', err);
      setError('Failed to initialize 3D scene');
    }
  };

  /**
   * カーネルを起動
   */
  const startKernelWithRetry = async (
    manager: KernelManager,
    retries: number = 3,
    delay: number = 1000
  ): Promise<Kernel.IKernelConnection> => {
    let lastError: Error | null = null;
    
    for (let i = 0; i < retries; i++) {
      try {
        const kernel = await manager.startNew({ name: 'python3' });
        return kernel;
      } catch (err: any) {
        lastError = err;
        const isLastAttempt = i === retries - 1;
        if (isLastAttempt) {
          break;
        }
        console.warn(`カーネル起動試行 ${i + 1}/${retries} 失敗:`, err.message);
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
    
    throw new Error(
      `カーネルの起動に失敗しました (${retries}回試行): ${lastError?.message || '不明なエラー'}`
    );
  };

  const startKernel = async () => {
    if (isInitializing) {
      return;
    }

    setIsInitializing(true);
    setError('');

    try {
      if (!kernelManagerRef.current) {
        kernelManagerRef.current = new KernelManager();
      }

      const kernel = await startKernelWithRetry(kernelManagerRef.current);
      kernelRef.current = kernel;
      setIsKernelReady(true);
      setError('');

      kernel.statusChanged.connect((_: Kernel.IKernelConnection, status: Kernel.Status) => {
        if (status === 'dead' || status === 'terminating') {
          setIsKernelReady(false);
        }
      });
    } catch (err: any) {
      const errorMsg = `Kernel の起動に失敗しました。\n詳細: ${err.message}`;
      setError(errorMsg);
      console.error('Kernel start error:', err);
    } finally {
      setIsInitializing(false);
    }
  };

  const stopKernel = async () => {
    if (kernelRef.current) {
      try {
        await kernelRef.current.shutdown();
        kernelRef.current = null;
        setIsKernelReady(false);
      } catch (err) {
        console.error('Kernel stop error:', err);
      }
    }
  };

  const cleanUp = () => {
    stopKernel();
    if (sceneManagerRef.current) {
      sceneManagerRef.current.dispose();
      sceneManagerRef.current = null;
    }
  };

  /**
   * 新しいエディタウィンドウを作成
   */
  const createEditorWindow = () => {
    if (!windowManagerRef.current) return;

    const count = windows.filter(w => w.type === 'editor').length;
    const title = count === 0 ? 'Code Cell' : `Code Cell ${count + 1}`;
    
    windowManagerRef.current.createWindow('editor', title, 'print("Hello, Jupyter!")');
  };

  /**
   * 新しいマークダウンウィンドウを作成
   */
  const createMarkdownWindow = () => {
    if (!windowManagerRef.current) return;

    const count = windows.filter(w => w.type === 'markdown').length;
    const title = count === 0 ? 'Markdown' : `Markdown ${count + 1}`;
    
    windowManagerRef.current.createWindow('markdown', title, '# Markdown\n\nEdit me...');
  };

  /**
   * エディタウィンドウに紐付いた出力ウィンドウを作成
   */
  const createOutputWindow = (editorWindowId: string) => {
    if (!windowManagerRef.current) return;

    const editorWindow = windowManagerRef.current.getWindow(editorWindowId);
    if (!editorWindow) return;

    // 既に出力ウィンドウが存在する場合は作成しない
    const existingOutput = windows.find(
      w => w.type === 'output' && w.linkedWindowId === editorWindowId
    );
    if (existingOutput) return;

    const title = `Output: ${editorWindow.title}`;
    const outputX = editorWindow.x + editorWindow.width + 20;
    const outputY = editorWindow.y;
    
    const outputId = windowManagerRef.current.createWindow(
      'output',
      title,
      '',
      editorWindowId
    );

    // 位置を調整
    windowManagerRef.current.updatePosition(outputId, outputX, outputY);
  };

  /**
   * ウィンドウハンドラー
   */
  const handleCloseWindow = (id: string) => {
    windowManagerRef.current?.closeWindow(id);
  };

  const handleMinimizeWindow = (id: string) => {
    windowManagerRef.current?.minimizeWindow(id);
  };

  const handleBringToFront = (id: string) => {
    windowManagerRef.current?.bringToFront(id);
  };

  const handleUpdatePosition = (id: string, x: number, y: number) => {
    windowManagerRef.current?.updatePosition(id, x, y);
  };

  const handleUpdateSize = (id: string, width: number, height: number) => {
    windowManagerRef.current?.updateSize(id, width, height);
  };

  const handleUpdateContent = (id: string, content: string) => {
    windowManagerRef.current?.updateContent(id, content);
  };

  return (
    <div className="three-jupyter-container">
      <header className="toolbar">
        <h1>Three Jupyter</h1>
        <div className="toolbar-status">
          <span className={`status-indicator ${isKernelReady ? 'ready' : 'not-ready'}`}>
            Kernel: {isKernelReady ? '準備完了' : isInitializing ? '初期化中...' : '未起動'}
          </span>
          {isKernelReady ? (
            <button onClick={stopKernel} className="btn btn-secondary">
              Kernel 停止
            </button>
          ) : (
            <button onClick={startKernel} className="btn btn-primary" disabled={isInitializing}>
              {isInitializing ? '起動中...' : 'Kernel 起動'}
            </button>
          )}
        </div>
        <div className="toolbar-buttons">
          <button onClick={createEditorWindow} className="btn btn-primary" title="新しいコードセル">
            + Code
          </button>
          <button onClick={createMarkdownWindow} className="btn btn-secondary" title="新しいマークダウンセル">
            + Markdown
          </button>
        </div>
      </header>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <div ref={containerRef} className="scene-container">
        {/* Three.jsシーンがここにレンダリングされる */}
      </div>

      {/* フローティングウィンドウをCSS2DコンテナにPortalでレンダリング */}
      {floatingContainer && createPortal(
        <>
          {windows.map(window => {
            switch (window.type) {
              case 'editor':
                return (
                  <FloatingEditorWindow
                    key={window.id}
                    window={window}
                    kernel={kernelRef.current}
                    onClose={() => handleCloseWindow(window.id)}
                    onMinimize={() => handleMinimizeWindow(window.id)}
                    onBringToFront={() => handleBringToFront(window.id)}
                    onUpdatePosition={(x, y) => handleUpdatePosition(window.id, x, y)}
                    onUpdateSize={(w, h) => handleUpdateSize(window.id, w, h)}
                    onUpdateContent={(content) => handleUpdateContent(window.id, content)}
                    onCreateOutputWindow={createOutputWindow}
                  />
                );
              case 'markdown':
                return (
                  <FloatingMarkdownWindow
                    key={window.id}
                    window={window}
                    onClose={() => handleCloseWindow(window.id)}
                    onMinimize={() => handleMinimizeWindow(window.id)}
                    onBringToFront={() => handleBringToFront(window.id)}
                    onUpdatePosition={(x, y) => handleUpdatePosition(window.id, x, y)}
                    onUpdateSize={(w, h) => handleUpdateSize(window.id, w, h)}
                    onUpdateContent={(content) => handleUpdateContent(window.id, content)}
                  />
                );
              default:
                return null;
            }
          })}
        </>,
        floatingContainer
      )}

      {/* 出力ウィンドウを出力コンテナにPortalでレンダリング */}
      {outputContainer && createPortal(
        <>
          {windows.map(window => {
            if (window.type === 'output') {
              return (
                <FloatingOutputWindow
                  key={window.id}
                  window={window}
                  kernel={kernelRef.current}
                  onClose={() => handleCloseWindow(window.id)}
                  onMinimize={() => handleMinimizeWindow(window.id)}
                  onBringToFront={() => handleBringToFront(window.id)}
                  onUpdatePosition={(x, y) => handleUpdatePosition(window.id, x, y)}
                  onUpdateSize={(w, h) => handleUpdateSize(window.id, w, h)}
                />
              );
            }
            return null;
          })}
        </>,
        outputContainer
      )}
    </div>
  );
};

/**
 * A Lumino widget that wraps a React component.
 */
export class ThreeJupyterWidget extends ReactWidget {
  constructor() {
    super();
    this.addClass('three-jupyter-widget');
  }

  render(): React.ReactElement {
    return <ThreeJupyterComponent />;
  }
}

