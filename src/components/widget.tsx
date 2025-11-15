import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { parseNotebook, categorizeCells, convertNotebookOutputs } from '../utils/notebook-parser';
import type { OutputItem } from '../services/floating-window-manager';

interface ThreeJupyterProps {
  context?: DocumentRegistry.IContext<INotebookModel>;
  onSaveNotebookRef?: (ref: () => Promise<void>) => void;
}

const ThreeJupyterComponent: React.FC<ThreeJupyterProps> = ({ context, onSaveNotebookRef }) => {
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
      return;
    }

    if (notebookLoadedRef.current) {
      return;
    }

    const loadNotebook = async () => {
      try {
        
        // モデルが準備されるまで待つ
        await context.ready;
        
        const model = context.model;
        if (!model) {
          console.warn('Model not available for context:', context.path);
          return;
        }

        // windowManagerが初期化されるまで待つ
        if (!windowManagerRef.current) {
          setTimeout(loadNotebook, 200);
          return;
        }

        // NotebookのJSONデータを取得
        const notebookData = model.toJSON() as any;
        
        // セルを解析
        const cells = parseNotebook(notebookData);
        if (cells.length === 0) {
          return;
        }

        // 既存のウィンドウをクリア
        windowManagerRef.current.clearAllWindows();

        // セルを分類
        const { codeCells, markdownCells } = categorizeCells(cells);

        // コードセルをエディタウィンドウとして作成
        codeCells.forEach((cell, index) => {
          const source = typeof cell.source === 'string' ? cell.source : cell.source.join('');
          const title = `Code Cell ${index + 1}`;
          const windowId = windowManagerRef.current?.createWindow('editor', title, source);
          
          // 出力がある場合は出力ウィンドウも作成
          if (cell.outputs && cell.outputs.length > 0 && windowId) {
            // 出力データを変換
            const outputItems = convertNotebookOutputs(cell.outputs);
            
            // 出力ウィンドウは後で作成（エディタウィンドウの位置が確定してから）
            setTimeout(() => {
              createOutputWindow(windowId, outputItems);
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

        // ウィンドウマネージャーから現在のウィンドウリストを取得して状態を更新
        // notifyListeners()が自動的に呼ばれるはずだが、念のため手動で更新
        if (windowManagerRef.current) {
          const currentWindows = windowManagerRef.current.getAllWindows();
          setWindows(currentWindows);
          
          // 状態更新を確実にするため、少し遅延させて再度更新
          setTimeout(() => {
            const updatedWindows = windowManagerRef.current?.getAllWindows();
            if (updatedWindows) {
              setWindows(updatedWindows);
            }
          }, 100);
        }

        notebookLoadedRef.current = true;
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

  /**
   * ウィンドウの内容をNotebook形式に変換して保存
   */
  const saveNotebook = useCallback(async () => {
    if (!context || !windowManagerRef.current) {
      return;
    }

    // contextが既にdisposeされている場合は保存しない
    if (context.isDisposed) {
      console.warn('Context is already disposed, skipping save');
      return;
    }

    try {
      await context.ready;
      const model = context.model;
      if (!model) {
        console.warn('Model not available for saving');
        return;
      }
      
      // modelが既にdisposeされている場合は保存しない
      if (model.isDisposed) {
        console.warn('Model is already disposed, skipping save');
        return;
      }

      // すべてのウィンドウを取得
      const allWindows = windowManagerRef.current.getAllWindows();
      
      // エディタウィンドウとマークダウンウィンドウを取得（出力ウィンドウは除外）
      const editorWindows = allWindows.filter(w => w.type === 'editor');
      const markdownWindows = allWindows.filter(w => w.type === 'markdown');
      
      // Notebook形式のセル配列を作成
      const cells: any[] = [];
      
      // エディタウィンドウをコードセルとして追加
      editorWindows.forEach((window) => {
        const source = window.content || '';
        const cell: any = {
          cell_type: 'code',
          source: source.split('\n'),
          metadata: {},
          execution_count: null,
          outputs: []
        };
        
        // リンクされた出力ウィンドウがある場合は、出力を追加
        const outputWindow = allWindows.find(
          w => w.type === 'output' && w.linkedWindowId === window.id
        );
        
        if (outputWindow && outputWindow.initialOutputs) {
          // OutputItemをNotebook形式の出力に変換
          const notebookOutputs: any[] = [];
          outputWindow.initialOutputs.forEach((outputItem) => {
            if (outputItem.type === 'stream') {
              notebookOutputs.push({
                output_type: 'stream',
                name: 'stdout',
                text: outputItem.content.split('\n')
              });
            } else if (outputItem.type === 'execute_result' || outputItem.type === 'display_data') {
              notebookOutputs.push({
                output_type: outputItem.type,
                data: {
                  'text/plain': [outputItem.content]
                },
                metadata: {}
              });
            } else if (outputItem.type === 'error') {
              const lines = outputItem.content.split('\n');
              const ename = lines[0]?.split(':')[0] || 'Error';
              const evalue = lines[0]?.split(':').slice(1).join(':').trim() || '';
              notebookOutputs.push({
                output_type: 'error',
                ename: ename,
                evalue: evalue,
                traceback: lines.slice(1)
              });
            }
          });
          cell.outputs = notebookOutputs;
        }
        
        cells.push(cell);
      });
      
      // マークダウンウィンドウをマークダウンセルとして追加
      markdownWindows.forEach((window) => {
        const source = window.content || '';
        cells.push({
          cell_type: 'markdown',
          source: source.split('\n'),
          metadata: {}
        });
      });
      
      // 既存のNotebookデータを取得
      const currentNotebook = model.toJSON() as any;
      
      // Notebook形式のデータを作成
      const notebookData = {
        cells: cells,
        metadata: currentNotebook.metadata || {
          kernelspec: {
            display_name: 'Python 3',
            language: 'python',
            name: 'python3'
          },
          language_info: {
            name: 'python',
            version: '3.0.0'
          }
        },
        nbformat: currentNotebook.nbformat || 4,
        nbformat_minor: currentNotebook.nbformat_minor || 4
      };
      
      // モデルを更新
      model.fromJSON(notebookData);
      
      // 保存
      await context.save();
      console.log('Notebook saved successfully');
    } catch (error) {
      console.error('Error saving notebook:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
      }
    }
  }, [context]);

  // saveNotebook関数の参照を親コンポーネントに渡す
  useEffect(() => {
    if (onSaveNotebookRef) {
      onSaveNotebookRef(saveNotebook);
    }
  }, [onSaveNotebookRef, saveNotebook]);

  const cleanUp = async () => {
    // cleanUpでは保存しない（disposeメソッドで保存される）
    // ここで保存すると、contextが既にdisposeされている可能性がある
    
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
  const createOutputWindow = (editorWindowId: string, initialOutputs?: OutputItem[]) => {
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
      editorWindowId,
      initialOutputs
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
  private _saveNotebookRef?: () => Promise<void>;

  constructor(context?: DocumentRegistry.IContext<INotebookModel>) {
    super();
    this.addClass('three-jupyter-widget');
    this._context = context;
  }

  /**
   * 保存関数の参照を設定
   */
  public setSaveNotebookRef(ref: () => Promise<void>): void {
    this._saveNotebookRef = ref;
  }

  /**
   * 手動で保存を実行（Ctrl+Sなどから呼び出される）
   */
  public async save(): Promise<void> {
    if (this._saveNotebookRef) {
      try {
        await this._saveNotebookRef();
      } catch (error) {
        console.error('Error saving notebook:', error);
        throw error;
      }
    }
  }

  /**
   * ウィジェットが破棄される時に保存を実行
   */
  async dispose(): Promise<void> {
    // contextがまだ有効な場合のみ保存を試みる
    if (this._saveNotebookRef && this._context && !this._context.isDisposed) {
      try {
        await this._saveNotebookRef();
      } catch (error) {
        // エラーが発生してもログに記録するだけで、disposeは続行
        console.error('Error saving notebook on dispose:', error);
      }
    }
    super.dispose();
  }

  render(): React.ReactElement {
    return <ThreeJupyterComponent context={this._context} onSaveNotebookRef={(ref) => this.setSaveNotebookRef(ref)} />;
  }
}

