import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { KernelManager, Kernel } from '@jupyterlab/services';
import { ReactWidget } from '@jupyterlab/apputils';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { INotebookModel } from '@jupyterlab/notebook';
import { SceneManager } from '../services/scene-manager';
import { FloatingWindowManager } from '../services/floating-window-manager';
import { FloatingEditorWindow } from './floating-editor-window';
import { FloatingOutputWindow } from './floating-output-window';
import { FloatingMarkdownWindow } from './floating-markdown-window';
import { parseNotebook, categorizeCells } from '../utils/notebook-parser';

interface ThreeJupyterProps {
  context?: DocumentRegistry.IContext<INotebookModel>;
}

const ThreeJupyterComponent: React.FC<ThreeJupyterProps> = ({ context }) => {
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
  const notebookLoadedRef = useRef<boolean>(false);

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

  // ipynbファイルの内容を読み込む
  useEffect(() => {
    if (!context) {
      console.log('No context provided, skipping notebook load');
      return;
    }

    if (notebookLoadedRef.current) {
      console.log('Notebook already loaded, skipping');
      return;
    }

    const loadNotebook = async () => {
      try {
        console.log('Loading notebook from context:', context.path);
        
        // モデルが準備されるまで待つ
        await context.ready;
        console.log('Context ready');
        
        const model = context.model;
        if (!model) {
          console.warn('Model not available for context:', context.path);
          return;
        }

        // windowManagerが初期化されるまで待つ
        if (!windowManagerRef.current) {
          console.log('WindowManager not ready yet, waiting...');
          setTimeout(loadNotebook, 200);
          return;
        }

        console.log('WindowManager ready, loading notebook data');
        
        // NotebookのJSONデータを取得
        const notebookData = model.toJSON() as any;
        console.log('Notebook data loaded, cells count:', notebookData?.cells?.length || 0);
        
        // セルを解析
        const cells = parseNotebook(notebookData);
        console.log('Parsed cells:', cells.length);
        if (cells.length === 0) {
          console.log('No cells found in notebook');
          return;
        }

        // 既存のウィンドウをクリア
        windowManagerRef.current.clearAllWindows();
        console.log('Cleared existing windows');

        // セルを分類
        const { codeCells, markdownCells } = categorizeCells(cells);
        console.log(`Found ${codeCells.length} code cells and ${markdownCells.length} markdown cells`);

        // コードセルをエディタウィンドウとして作成
        codeCells.forEach((cell, index) => {
          const source = typeof cell.source === 'string' ? cell.source : cell.source.join('');
          const title = `Code Cell ${index + 1}`;
          const windowId = windowManagerRef.current?.createWindow('editor', title, source);
          console.log(`Created code cell window ${index + 1}: ${windowId}`);
          
          // 出力がある場合は出力ウィンドウも作成
          if (cell.outputs && cell.outputs.length > 0 && windowId) {
            // 出力ウィンドウは後で作成（エディタウィンドウの位置が確定してから）
            setTimeout(() => {
              createOutputWindow(windowId);
            }, 200);
          }
        });

        // マークダウンセルをマークダウンウィンドウとして作成
        markdownCells.forEach((cell, index) => {
          const source = typeof cell.source === 'string' ? cell.source : cell.source.join('');
          const title = `Markdown ${index + 1}`;
          const windowId = windowManagerRef.current?.createWindow('markdown', title, source);
          console.log(`Created markdown cell window ${index + 1}: ${windowId}`);
        });

        notebookLoadedRef.current = true;
        console.log(`Successfully loaded ${cells.length} cells from notebook`);
      } catch (error) {
        console.error('Error loading notebook:', error);
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      }
    };

    // シーンが初期化されるまで待つ（最大10秒）
    let attempts = 0;
    const maxAttempts = 50; // 5秒（100ms * 50）
    
    const checkAndLoad = () => {
      attempts++;
      if (windowManagerRef.current) {
        console.log('WindowManager ready, starting notebook load');
        loadNotebook();
      } else if (attempts < maxAttempts) {
        setTimeout(checkAndLoad, 100);
      } else {
        console.error('WindowManager not initialized after maximum attempts');
      }
    };

    // 少し遅延させてからチェック開始（シーンの初期化を待つ）
    setTimeout(checkAndLoad, 500);
  }, [context]);

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
      {/* ツールバー - 右上に配置 */}
      <div className="toolbar">
        <button onClick={createEditorWindow} className="toolbar-btn" title="新しいコードセル">
          +
        </button>
        <button onClick={createMarkdownWindow} className="toolbar-btn info-btn" title="新しいマークダウンセル">
          i
        </button>
      </div>

      {/* Kernel status - 左下に配置 */}
      <div className="kernel-status">
        {isKernelReady ? (
          <button onClick={stopKernel} className="kernel-btn">
            ⏹️
          </button>
        ) : (
          <button onClick={startKernel} className="kernel-btn" disabled={isInitializing}>
            {isInitializing ? '⏳' : '▶️'}
          </button>
        )}
      </div>

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
  private _context?: DocumentRegistry.IContext<INotebookModel>;

  constructor(context?: DocumentRegistry.IContext<INotebookModel>) {
    super();
    this.addClass('three-jupyter-widget');
    this._context = context;
  }

  render(): React.ReactElement {
    return <ThreeJupyterComponent context={this._context} />;
  }
}

