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

