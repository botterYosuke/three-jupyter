import React, { useState, useEffect, useRef } from 'react';
import { KernelManager, Kernel, KernelMessage } from '@jupyterlab/services';
import { ReactWidget } from '@jupyterlab/apputils';

interface ThreeJupyterProps {}

const ThreeJupyterComponent: React.FC<ThreeJupyterProps> = () => {
  const [code, setCode] = useState<string>('print("Hello, Jupyter!")');
  const [output, setOutput] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [isKernelReady, setIsKernelReady] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const kernelRef = useRef<Kernel.IKernelConnection | null>(null);
  const kernelManagerRef = useRef<KernelManager | null>(null);

  useEffect(() => {
    // Kernel Managerを初期化
    kernelManagerRef.current = new KernelManager();
    startKernel();

    // クリーンアップ
    return () => {
      stopKernel();
    };
  }, []);

  const startKernel = async () => {
    try {
      if (!kernelManagerRef.current) {
        kernelManagerRef.current = new KernelManager();
      }

      // カーネルを起動（デフォルトはpython3）
      const kernel = await kernelManagerRef.current.startNew({
        name: 'python3'
      });

      kernelRef.current = kernel;
      setIsKernelReady(true);
      setOutput('Kernel が起動しました。\n');
      setError('');

      // カーネルの状態変更を監視
      kernel.statusChanged.connect((_: Kernel.IKernelConnection, status: Kernel.Status) => {
        if (status === 'dead' || status === 'terminating') {
          setIsKernelReady(false);
          setOutput((prev: string) => prev + '\nKernel が停止しました。');
        }
      });
    } catch (err: any) {
      setError(`Kernel の起動に失敗しました: ${err.message}`);
      console.error('Kernel start error:', err);
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
                isKernelReady ? 'ready' : 'not-ready'
              }`}
            >
              {isKernelReady ? '準備完了' : '未起動'}
            </span>
          </div>
          {isKernelReady ? (
            <button onClick={stopKernel} className="btn btn-secondary">
              Kernel 停止
            </button>
          ) : (
            <button onClick={startKernel} className="btn btn-primary">
              Kernel 起動
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

