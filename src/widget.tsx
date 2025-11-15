import React, { useState, useEffect, useRef } from 'react';
import { KernelManager, Kernel, KernelMessage } from '@jupyterlab/services';
import { ReactWidget } from '@jupyterlab/apputils';

interface ThreeJupyterProps {}

const ThreeJupyterComponent: React.FC<ThreeJupyterProps> = () => {
  const [code, setCode] = useState<string>('print("Hello, Jupyter!")');
  const [output, setOutput] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [isKernelReady, setIsKernelReady] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const kernelRef = useRef<Kernel.IKernelConnection | null>(null);
  const kernelManagerRef = useRef<KernelManager | null>(null);
  const initializationAttemptedRef = useRef<boolean>(false);

  useEffect(() => {
    // 起動直後のAPIエラーを避けるため、少し遅延させてから初期化
    const initTimer = setTimeout(() => {
      if (!initializationAttemptedRef.current) {
        initializationAttemptedRef.current = true;
        startKernel();
      }
    }, 1000); // 1秒待ってから初期化

    // クリーンアップ
    return () => {
      clearTimeout(initTimer);
      stopKernel();
    };
  }, []);

  /**
   * カーネルを起動する（リトライ付き）
   * startNew()の呼び出し時に/api/kernelsが呼ばれる可能性があるため、
   * エラーが発生した場合はリトライする
   */
  const startKernelWithRetry = async (
    manager: KernelManager,
    retries: number = 3,
    delay: number = 1000
  ): Promise<Kernel.IKernelConnection> => {
    let lastError: Error | null = null;
    
    for (let i = 0; i < retries; i++) {
      try {
        // カーネルを起動（デフォルトはpython3）
        // この呼び出しで/api/kernelsが呼ばれる可能性がある
        const kernel = await manager.startNew({
          name: 'python3'
        });
        return kernel;
      } catch (err: any) {
        lastError = err;
        const isLastAttempt = i === retries - 1;
        if (isLastAttempt) {
          break;
        }
        console.warn(`カーネル起動試行 ${i + 1}/${retries} 失敗:`, err.message);
        // 指数バックオフでリトライ
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
    
    // すべてのリトライが失敗した場合
    throw new Error(
      `カーネルの起動に失敗しました (${retries}回試行): ${lastError?.message || '不明なエラー'}`
    );
  };

  const startKernel = async () => {
    if (isInitializing) {
      return; // 既に初期化中
    }

    setIsInitializing(true);
    setError('');
    setOutput((prev: string) => prev + 'Kernel を起動中...\n');

    try {
      // KernelManagerを初期化（同期的なのでエラーは発生しない）
      if (!kernelManagerRef.current) {
        kernelManagerRef.current = new KernelManager();
      }

      // カーネルを起動（リトライ付き）
      const kernel = await startKernelWithRetry(kernelManagerRef.current);

      kernelRef.current = kernel;
      setIsKernelReady(true);
      setOutput((prev: string) => prev + 'Kernel が起動しました。\n');
      setError('');

      // カーネルの状態変更を監視
      kernel.statusChanged.connect((_: Kernel.IKernelConnection, status: Kernel.Status) => {
        if (status === 'dead' || status === 'terminating') {
          setIsKernelReady(false);
          setOutput((prev: string) => prev + '\nKernel が停止しました。');
        }
      });
    } catch (err: any) {
      const errorMsg = `Kernel の起動に失敗しました。JupyterLab の API が準備できていない可能性があります。\n詳細: ${err.message}\n\n「Kernel 起動」ボタンをクリックして再試行してください。`;
      setError(errorMsg);
      setOutput((prev: string) => prev + `エラー: ${errorMsg}\n`);
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
        setOutput((prev: string) => prev + '\nKernel が停止しました。');
      } catch (err) {
        console.error('Kernel stop error:', err);
      }
    }
  };

  const executeCode = async () => {
    if (!isKernelReady || !kernelRef.current) {
      setError('Kernel が起動していません。');
      return;
    }

    if (!code.trim()) {
      setError('コードを入力してください。');
      return;
    }

    setIsExecuting(true);
    setError('');
    setOutput((prev: string) => prev + `\n>>> ${code}\n`);

    try {
      const kernel = kernelRef.current;
      const future = kernel.requestExecute({ code });

      // 実行結果を処理
      future.onIOPub = (msg: KernelMessage.IIOPubMessage) => {
        const msgType = msg.header.msg_type;
        const content = msg.content as any;

        if (msgType === 'execute_result') {
          const data = content.data;
          const text = data['text/plain'] || data['text/html'] || String(data);
          setOutput((prev: string) => prev + text + '\n');
        } else if (msgType === 'stream') {
          const text = content.text || '';
          setOutput((prev: string) => prev + text);
        } else if (msgType === 'error') {
          const errorMsg = `${content.ename}: ${content.evalue}`;
          setOutput((prev: string) => prev + `エラー: ${errorMsg}\n`);
          if (content.traceback) {
            const traceback = content.traceback.join('\n');
            setOutput((prev: string) => prev + traceback + '\n');
          }
        }
      };

      // 実行完了を待機
      await future.done;
      setIsExecuting(false);
    } catch (err: any) {
      setIsExecuting(false);
      setError(`実行エラー: ${err.message}`);
      setOutput((prev: string) => prev + `エラー: ${err.message}\n`);
      console.error('Execute error:', err);
    }
  };

  const clearOutput = () => {
    setOutput('');
    setError('');
  };

  return (
    <div className="three-jupyter-container">
      <header>
        <h1>Three Jupyter</h1>
        <p className="subtitle">JupyterLab Extension with Custom UI</p>
      </header>

      <div className="main-content">
        <div className="status-bar">
          <div className="status-item">
            <span className="status-label">Kernel ステータス:</span>
            <span
              className={`status-indicator ${
                isKernelReady ? 'ready' : isInitializing ? 'initializing' : 'not-ready'
              }`}
            >
              {isKernelReady ? '準備完了' : isInitializing ? '初期化中...' : '未起動'}
            </span>
          </div>
          {isKernelReady ? (
            <button onClick={stopKernel} className="btn btn-secondary" disabled={isInitializing}>
              Kernel 停止
            </button>
          ) : (
            <button 
              onClick={startKernel} 
              className="btn btn-primary" 
              disabled={isInitializing}
            >
              {isInitializing ? '起動中...' : 'Kernel 起動'}
            </button>
          )}
        </div>

        <div className="code-section">
          <div className="section-header">
            <h2>コード入力</h2>
          </div>
          <textarea
            value={code}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCode(e.target.value)}
            className="code-input"
            placeholder="Python コードを入力してください..."
            rows={10}
          />
          <div className="button-group">
            <button
              onClick={executeCode}
              disabled={!isKernelReady || isExecuting}
              className="btn btn-primary btn-execute"
            >
              {isExecuting ? '実行中...' : '実行'}
            </button>
            <button onClick={clearOutput} className="btn btn-secondary">
              出力をクリア
            </button>
          </div>
        </div>

        <div className="output-section">
          <div className="section-header">
            <h2>出力</h2>
          </div>
          <div className="output-container">
            <pre className="output-text">{output || '(出力なし)'}</pre>
          </div>
          {error && <div className="error-message">{error}</div>}
        </div>
      </div>
    </div>
  );
};

/**
 * A Lumino widget that wraps a React component.
 */
export class ThreeJupyterWidget extends ReactWidget {
  /**
   * Constructs a new ThreeJupyterWidget.
   */
  constructor() {
    super();
    this.addClass('three-jupyter-widget');
  }

  render(): React.ReactElement {
    return <ThreeJupyterComponent />;
  }
}

