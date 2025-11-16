/**
 * フローティングエディタウィンドウコンポーネント
 * Monaco Editorを使用してPythonコードを編集・実行
 */

import React, { useEffect, useRef, useState } from 'react';
import type { Kernel } from '@jupyterlab/services';
import type { FloatingWindow } from '../services/floating-window-manager';

interface FloatingEditorWindowProps {
  window: FloatingWindow;
  kernel: Kernel.IKernelConnection | null;
  onClose: () => void;
  onMinimize: () => void;
  onBringToFront: () => void;
  onUpdatePosition: (x: number, y: number) => void;
  onUpdateSize: (width: number, height: number) => void;
  onUpdateContent: (content: string) => void;
  onCreateOutputWindow: (editorWindowId: string) => void;
}

export const FloatingEditorWindow: React.FC<FloatingEditorWindowProps> = ({
  window: windowData,
  kernel,
  onClose,
  onMinimize,
  onBringToFront,
  onUpdatePosition,
  onUpdateSize,
  onUpdateContent,
  onCreateOutputWindow
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // Monaco Editorの初期化
  useEffect(() => {
    if (!editorRef.current) return;

    const initEditor = async () => {
      const win = window as any;
      
      // Monaco EditorのローダーをJupyterLab環境で読み込む
      if (!win.monaco) {
        // Monaco EditorはCDNから読み込む必要がある場合がある
        // JupyterLab環境では、適切にパスを設定する
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js';
        script.onload = () => {
          win.require.config({ 
            paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' }
          });
          win.require(['vs/editor/editor.main'], () => {
            createEditor();
          });
        };
        document.head.appendChild(script);
      } else {
        createEditor();
      }
    };

    const createEditor = () => {
      const win = window as any;
      if (!editorRef.current || editorInstanceRef.current) return;

      editorInstanceRef.current = win.monaco.editor.create(editorRef.current, {
        value: windowData.content,
        language: 'python',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
      });

      // コンテンツ変更を監視
      editorInstanceRef.current.onDidChangeModelContent(() => {
        const content = editorInstanceRef.current.getValue();
        onUpdateContent(content);
      });

      // Ctrl+Enterで実行
      editorInstanceRef.current.addCommand(
        win.monaco.KeyMod.CtrlCmd | win.monaco.KeyCode.Enter,
        () => {
          handleExecute();
        }
      );
    };

    initEditor();

    return () => {
      if (editorInstanceRef.current) {
        editorInstanceRef.current.dispose();
        editorInstanceRef.current = null;
      }
    };
  }, []);

  // コード実行
  const handleExecute = async () => {
    if (!kernel || !editorInstanceRef.current || isExecuting) return;

    const code = editorInstanceRef.current.getValue();
    if (!code.trim()) return;

    setIsExecuting(true);

    // 出力ウィンドウを作成（まだ存在しない場合）
    if (!windowData.linkedWindowId) {
      onCreateOutputWindow(windowData.id);
    }

    try {
      const future = kernel.requestExecute({ code });
      await future.done;
    } catch (error) {
      console.error('Execution error:', error);
    } finally {
      setIsExecuting(false);
    }
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

  return (
    <div
      className={`floating-window floating-editor-window ${windowData.isMinimized ? 'minimized' : ''}`}
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
            className="titlebar-btn run-btn"
            onClick={handleExecute}
            disabled={!kernel || isExecuting}
            title="Run code (Ctrl+Enter)"
          >
            {isExecuting ? '⏳' : '▶️'}
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

      {!windowData.isMinimized && (
        <>
          <div className="window-content">
            <div ref={editorRef} className="editor-host" />
          </div>

          <div className="resize-handle" onMouseDown={handleResizeMouseDown} />
        </>
      )}
    </div>
  );
};

