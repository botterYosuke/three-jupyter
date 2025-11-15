/**
 * フローティングマークダウンウィンドウコンポーネント
 * マークダウンを編集・表示
 */

import React, { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import type { FloatingWindow } from '../services/floating-window-manager';

interface FloatingMarkdownWindowProps {
  window: FloatingWindow;
  onClose: () => void;
  onMinimize: () => void;
  onBringToFront: () => void;
  onUpdatePosition: (x: number, y: number) => void;
  onUpdateSize: (width: number, height: number) => void;
  onUpdateContent: (content: string) => void;
}

export const FloatingMarkdownWindow: React.FC<FloatingMarkdownWindowProps> = ({
  window: windowData,
  onClose,
  onMinimize,
  onBringToFront,
  onUpdatePosition,
  onUpdateSize,
  onUpdateContent
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [markdown, setMarkdown] = useState(windowData.content || '# Markdown\n\nEdit me...');
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // markedの設定
  useEffect(() => {
    marked.setOptions({
      breaks: true,
      gfm: true
    });
  }, []);

  // マークダウンをHTMLに変換
  const renderMarkdown = (): string => {
    try {
      return marked.parse(markdown) as string;
    } catch (error) {
      console.error('Markdown rendering error:', error);
      return '<p>Error rendering markdown</p>';
    }
  };

  // 編集モード切り替え
  const toggleEditMode = () => {
    if (isEditMode) {
      // 編集完了時にコンテンツを保存
      onUpdateContent(markdown);
    }
    setIsEditMode(!isEditMode);
  };

  // マークダウンの変更
  const handleMarkdownChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMarkdown(e.target.value);
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
      className="floating-window floating-markdown-window"
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
            onClick={toggleEditMode}
            title={isEditMode ? 'Preview' : 'Edit'}
          >
            {isEditMode ? '👁️' : '✏️'}
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
        {isEditMode ? (
          <textarea
            ref={textareaRef}
            className="markdown-editor"
            value={markdown}
            onChange={handleMarkdownChange}
            placeholder="Enter markdown here..."
          />
        ) : (
          <div
            className="markdown-preview"
            dangerouslySetInnerHTML={{ __html: renderMarkdown() }}
          />
        )}
      </div>

      <div className="resize-handle" onMouseDown={handleResizeMouseDown} />
    </div>
  );
};

