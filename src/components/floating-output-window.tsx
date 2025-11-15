/**
 * フローティング出力ウィンドウコンポーネント
 * Jupyterセルの実行結果を表示
 */

import React, { useEffect, useRef, useState } from 'react';
import type { Kernel, KernelMessage } from '@jupyterlab/services';
import type { FloatingWindow } from '../floating-window-manager';

interface OutputItem {
  type: 'stream' | 'execute_result' | 'display_data' | 'error';
  content: string;
  timestamp: number;
}

interface FloatingOutputWindowProps {
  window: FloatingWindow;
  kernel: Kernel.IKernelConnection | null;
  onClose: () => void;
  onMinimize: () => void;
  onBringToFront: () => void;
  onUpdatePosition: (x: number, y: number) => void;
  onUpdateSize: (width: number, height: number) => void;
}

export const FloatingOutputWindow: React.FC<FloatingOutputWindowProps> = ({
  window: windowData,
  kernel,
  onClose,
  onMinimize,
  onBringToFront,
  onUpdatePosition,
  onUpdateSize
}) => {
  const [outputs, setOutputs] = useState<OutputItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const outputContainerRef = useRef<HTMLDivElement>(null);

  // Kernelからの出力を監視
  useEffect(() => {
    if (!kernel) return;

    const handleIOPub = (_sender: Kernel.IKernelConnection, msg: KernelMessage.IIOPubMessage) => {
      const msgType = msg.header.msg_type;
      const content = msg.content as any;

      let outputItem: OutputItem | null = null;

      switch (msgType) {
        case 'stream':
          outputItem = {
            type: 'stream',
            content: content.text || '',
            timestamp: Date.now()
          };
          break;

        case 'execute_result':
        case 'display_data':
          const data = content.data;
          let displayContent = '';
          
          if (data['text/html']) {
            displayContent = data['text/html'];
          } else if (data['text/plain']) {
            displayContent = data['text/plain'];
          } else if (data['image/png']) {
            displayContent = `<img src="data:image/png;base64,${data['image/png']}" />`;
          } else if (data['image/jpeg']) {
            displayContent = `<img src="data:image/jpeg;base64,${data['image/jpeg']}" />`;
          } else {
            displayContent = JSON.stringify(data, null, 2);
          }

          outputItem = {
            type: msgType as 'execute_result' | 'display_data',
            content: displayContent,
            timestamp: Date.now()
          };
          break;

        case 'error':
          const errorText = `${content.ename}: ${content.evalue}\n${
            content.traceback ? content.traceback.join('\n') : ''
          }`;
          outputItem = {
            type: 'error',
            content: errorText,
            timestamp: Date.now()
          };
          break;

        case 'execute_input':
          // コード入力は表示しない（エディタウィンドウで表示済み）
          break;

        default:
          // その他のメッセージタイプは無視
          break;
      }

      if (outputItem) {
        setOutputs(prev => [...prev, outputItem!]);
      }
    };

    kernel.iopubMessage.connect(handleIOPub);

    return () => {
      kernel.iopubMessage.disconnect(handleIOPub);
    };
  }, [kernel]);

  // 出力が追加されたら自動スクロール
  useEffect(() => {
    if (outputContainerRef.current) {
      outputContainerRef.current.scrollTop = outputContainerRef.current.scrollHeight;
    }
  }, [outputs]);

  // 出力をクリア
  const handleClearOutput = () => {
    setOutputs([]);
  };

  // タイトルバーのドラッグ開始
  const handleTitleBarMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - windowData.x, y: e.clientY - windowData.y });
    onBringToFront();
  };

  // リサイズハンドルのドラッグ開始
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: windowData.width,
      height: windowData.height
    });
  };

  // マウス移動
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;
        onUpdatePosition(newX, newY);
      } else if (isResizing) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        const newWidth = Math.max(400, resizeStart.width + deltaX);
        const newHeight = Math.max(300, resizeStart.height + deltaY);
        onUpdateSize(newWidth, newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart, resizeStart]);

  if (windowData.isMinimized) {
    return null;
  }

  return (
    <div
      className="floating-window floating-output-window"
      style={{
        position: 'absolute',
        left: `${windowData.x}px`,
        top: `${windowData.y}px`,
        width: `${windowData.width}px`,
        height: `${windowData.height}px`,
        zIndex: windowData.zIndex
      }}
      onMouseDown={onBringToFront}
    >
      <div className="window-titlebar" onMouseDown={handleTitleBarMouseDown}>
        <div className="titlebar-controls">
          <button
            className="titlebar-btn"
            onClick={handleClearOutput}
            title="Clear output"
          >
            🗑️
          </button>
        </div>
        <div className="titlebar-left">
          <span className="window-title">{windowData.title}</span>
        </div>
        <div className="titlebar-buttons">
          <button className="titlebar-btn" onClick={onMinimize} title="Minimize">
            −
          </button>
          <button className="titlebar-btn close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>
      </div>

      <div className="window-content">
        <div ref={outputContainerRef} className="output-container">
          {outputs.length === 0 ? (
            <div className="output-empty">Output will appear here...</div>
          ) : (
            outputs.map((output, index) => (
              <div key={index} className={`output-item output-${output.type}`}>
                {output.type === 'error' ? (
                  <pre className="output-error">{output.content}</pre>
                ) : output.content.startsWith('<') ? (
                  <div dangerouslySetInnerHTML={{ __html: output.content }} />
                ) : (
                  <pre className="output-text">{output.content}</pre>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="resize-handle" onMouseDown={handleResizeMouseDown} />
    </div>
  );
};

