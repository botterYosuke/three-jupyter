import type { OutputItem } from '../services/floating-window-manager';

/**
 * Notebook JSONフォーマットの型定義
 */
export interface NotebookCell {
  cell_type: 'code' | 'markdown' | 'raw';
  source: string | string[];
  metadata?: any;
  execution_count?: number | null;
  outputs?: any[];
}

export interface NotebookContent {
  cells: NotebookCell[];
  metadata?: any;
  nbformat?: number;
  nbformat_minor?: number;
}

/**
 * ipynbファイルのJSON構造を解析してセルを抽出
 * @param notebookData ipynbファイルのJSONデータ
 * @returns 解析されたセルの配列
 */
export function parseNotebook(notebookData: any): NotebookCell[] {
  try {
    // 文字列の場合はJSONとしてパース
    const data = typeof notebookData === 'string' 
      ? JSON.parse(notebookData) 
      : notebookData;

    // NotebookContentの形式を確認
    if (!data || !Array.isArray(data.cells)) {
      console.warn('Invalid notebook format: cells array not found');
      return [];
    }

    const cells: NotebookCell[] = [];
    
    for (const cell of data.cells) {
      if (!cell.cell_type) {
        continue;
      }

      // sourceを文字列に変換（配列の場合は結合）
      let source = '';
      if (Array.isArray(cell.source)) {
        source = cell.source.join('');
      } else if (typeof cell.source === 'string') {
        source = cell.source;
      }

      cells.push({
        cell_type: cell.cell_type,
        source: source,
        metadata: cell.metadata || {},
        execution_count: cell.execution_count ?? null,
        outputs: cell.outputs || []
      });
    }

    return cells;
  } catch (error) {
    console.error('Error parsing notebook:', error);
    return [];
  }
}

/**
 * セルをコードセルとマークダウンセルに分類
 * @param cells セルの配列
 * @returns 分類されたセル
 */
export function categorizeCells(cells: NotebookCell[]): {
  codeCells: NotebookCell[];
  markdownCells: NotebookCell[];
} {
  const codeCells: NotebookCell[] = [];
  const markdownCells: NotebookCell[] = [];

  for (const cell of cells) {
    if (cell.cell_type === 'code') {
      codeCells.push(cell);
    } else if (cell.cell_type === 'markdown') {
      markdownCells.push(cell);
    }
  }

  return { codeCells, markdownCells };
}

/**
 * Jupyter Notebookの出力データをOutputItem形式に変換
 * @param notebookOutputs ipynbファイルのoutputs配列
 * @returns 変換されたOutputItem配列
 */
export function convertNotebookOutputs(notebookOutputs: any[]): OutputItem[] {
  if (!Array.isArray(notebookOutputs) || notebookOutputs.length === 0) {
    return [];
  }

  const outputItems: OutputItem[] = [];

  for (const output of notebookOutputs) {
    const outputType = output.output_type;
    let item: OutputItem | null = null;

    switch (outputType) {
      case 'stream':
        // stream出力（stdout/stderr）
        const text = output.text || '';
        const streamText = Array.isArray(text) ? text.join('') : text;
        item = {
          type: 'stream',
          content: streamText,
          timestamp: Date.now()
        };
        break;

      case 'execute_result':
      case 'display_data':
        // 実行結果や表示データ
        const data = output.data || {};
        let displayContent = '';
        
        if (data['text/html']) {
          displayContent = Array.isArray(data['text/html']) 
            ? data['text/html'].join('') 
            : data['text/html'];
        } else if (data['text/plain']) {
          displayContent = Array.isArray(data['text/plain']) 
            ? data['text/plain'].join('') 
            : data['text/plain'];
        } else if (data['image/png']) {
          const imageData = Array.isArray(data['image/png']) 
            ? data['image/png'].join('') 
            : data['image/png'];
          displayContent = `<img src="data:image/png;base64,${imageData}" />`;
        } else if (data['image/jpeg']) {
          const imageData = Array.isArray(data['image/jpeg']) 
            ? data['image/jpeg'].join('') 
            : data['image/jpeg'];
          displayContent = `<img src="data:image/jpeg;base64,${imageData}" />`;
        } else {
          displayContent = JSON.stringify(data, null, 2);
        }

        item = {
          type: outputType as 'execute_result' | 'display_data',
          content: displayContent,
          timestamp: Date.now()
        };
        break;

      case 'error':
        // エラー出力
        const ename = output.ename || 'Error';
        const evalue = output.evalue || '';
        const traceback = output.traceback || [];
        const errorText = `${ename}: ${evalue}\n${
          Array.isArray(traceback) ? traceback.join('\n') : ''
        }`;
        
        item = {
          type: 'error',
          content: errorText,
          timestamp: Date.now()
        };
        break;

      default:
        // その他の出力タイプは無視
        break;
    }

    if (item) {
      outputItems.push(item);
    }
  }

  return outputItems;
}

