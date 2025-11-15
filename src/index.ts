import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ICommandPalette } from '@jupyterlab/apputils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { DocumentWidget } from '@jupyterlab/docregistry';
import { ILauncher } from '@jupyterlab/launcher';
import { Widget } from '@lumino/widgets';
import { ThreeJupyterWidget } from './components/widget';
import { NotebookManager } from './services/notebook-manager';

/**
 * Initialization data for the three-jupyterlab extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'three-jupyterlab:plugin',
  description: 'JupyterLab extension with custom UI for Python code execution',
  autoStart: true,
  optional: [ICommandPalette, ILauncher],
  requires: [IDocumentManager],
  activate: (app: JupyterFrontEnd, documentManager: IDocumentManager, palette: ICommandPalette | null, launcher: ILauncher | null) => {
    console.log('JupyterLab extension three-jupyterlab is activated!');
    let notebookManager: NotebookManager | null = null;

    // ウィジェットを作成する関数
    const createWidget = async () => {
      try {
        // 既存のウィジェットをチェック
        const widgets = Array.from(app.shell.widgets('main'));
        const existingWidget = widgets.find(
          (widget: Widget) => widget.id === 'three-jupyterlab'
        );

        if (existingWidget) {
          // 既存のウィジェットが開いている場合は、それをアクティブにする
          app.shell.activateById('three-jupyterlab');
          return;
        }

        // Untitled.ipynbを作成または取得
        const context = await documentManager.newUntitled({
          type: 'notebook'
        }) as any; // DocumentRegistry.IContext<INotebookModel> 相当

        // NotebookManagerを作成（contextを直接渡す）
        notebookManager = new NotebookManager({
          context
        });
        
        await notebookManager.initialize();

        // ウィジェットを作成
        const content = new ThreeJupyterWidget(notebookManager);
        const widget = new DocumentWidget({
          content,
          context: context as any
        });
        widget.id = 'three-jupyterlab';
        widget.title.label = 'Three Jupyter';
        widget.title.closable = true;

        // ウィジェットを追加
        app.shell.add(widget, 'main');
        app.shell.activateById('three-jupyterlab');
        console.log('Three Jupyter widget opened successfully');
      } catch (error) {
        console.error('Error creating widget:', error);
      }
    };

    // コマンドを登録（先に登録して、起動時の問題を回避）
    const command = 'three-jupyterlab:open';
    app.commands.addCommand(command, {
      label: 'Three Jupyter を開く',
      caption: 'カスタムUIでPythonコードを実行',
      execute: () => {
        createWidget();
      }
    });

    // コマンドパレットに追加
    if (palette) {
      palette.addItem({ command, category: 'Three Jupyter' });
    }

    // ランチャーに追加
    if (launcher) {
      launcher.add({
        command: command,
        category: 'Notebook',
        rank: 1
      });
    }

    // JupyterLabの復元が完了してからウィジェットを開く（非ブロッキング）
    // app.restored を待たずに、シェルが利用可能になったら開く
    const openWidgetWhenReady = async () => {
      try {
        // タイムアウト付きで app.restored を待つ（最大3秒）
        const timeoutPromise = new Promise<void>((resolve) => {
          setTimeout(() => {
            console.log('Opening widget without waiting for full restore...');
            resolve();
          }, 3000);
        });

        await Promise.race([app.restored, timeoutPromise]);
      } catch (error) {
        console.error('Error in app.restored:', error);
      }

      // 少し遅延させてからウィジェットを開く（シェルが完全に準備されるのを待つ）
      setTimeout(() => {
        console.log('Opening Three Jupyter widget...');
        createWidget();
      }, 500);
    };

    // 非同期で実行（activate をブロックしない）
    openWidgetWhenReady();
  }
};

export default plugin;

