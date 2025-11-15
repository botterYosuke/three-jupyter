import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ICommandPalette } from '@jupyterlab/apputils';
import { DocumentRegistry, DocumentWidget, IDocumentWidget, ABCWidgetFactory } from '@jupyterlab/docregistry';
import { ILauncher } from '@jupyterlab/launcher';
import { INotebookModel } from '@jupyterlab/notebook';
import { Widget } from '@lumino/widgets';
import { ThreeJupyterWidget } from './components/widget';

/**
 * Initialization data for the three-jupyterlab extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'three-jupyterlab:plugin',
  description: 'JupyterLab extension with custom UI for Python code execution',
  autoStart: true,
  optional: [ICommandPalette, ILauncher],
  activate: (app: JupyterFrontEnd, palette: ICommandPalette | null, launcher: ILauncher | null) => {

    // 新しいnotebookファイルを作成して開く関数
    const createNewNotebook = async () => {
      try {
        // 新しいnotebookファイルを作成
        const model = await app.serviceManager.contents.newUntitled({
          type: 'notebook'
        });

        if (!model || !model.path) {
          throw new Error('Failed to create notebook file: model or path is missing');
        }

        // 作成されたファイルを開く
        await app.commands.execute('docmanager:open', {
          path: model.path
        });
      } catch (error) {
        console.error('Error creating new notebook:', error);
        
        // エラーの詳細をログに記録
        if (error instanceof Error) {
          console.error('Error message:', error.message);
          console.error('Error stack:', error.stack);
        }
        
        // エラーが発生した場合は、ユーザーに通知する
        // 必要に応じて、エラーダイアログを表示することも可能
      }
    };

    // コマンドを登録（先に登録して、起動時の問題を回避）
    const command = 'three-jupyterlab:open';
    app.commands.addCommand(command, {
      label: 'Three Jupyter を開く',
      caption: 'カスタムUIでPythonコードを実行',
      execute: () => {
        createNewNotebook();
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

    // ipynbファイルタイプのハンドラーを登録
    // Three JupyterをデフォルトのNotebookビューアーとして設定
    class ThreeJupyterWidgetFactory extends ABCWidgetFactory<IDocumentWidget<Widget, INotebookModel>> {
      constructor(options: DocumentRegistry.IWidgetFactoryOptions<IDocumentWidget<Widget, INotebookModel>>) {
        super(options);
      }

      protected createNewWidget(context: DocumentRegistry.IContext<INotebookModel>): IDocumentWidget<Widget, INotebookModel> {
        const content = new ThreeJupyterWidget(context);
        const widget = new DocumentWidget({ content, context });
        widget.id = `three-jupyterlab-${context.path}`;
        widget.title.label = context.path.split('/').pop() || 'Three Jupyter';
        widget.title.closable = true;
        return widget;
      }
    }

    const factory = new ThreeJupyterWidgetFactory({
      name: 'Three Jupyter',
      modelName: 'notebook',
      fileTypes: ['notebook'],
      defaultFor: ['notebook']
    });

    app.docRegistry.addWidgetFactory(factory);

    // JupyterLabの復元が完了してからウィジェットを開く（非ブロッキング）
    // app.restored を待たずに、シェルが利用可能になったら開く
    /*
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
    */
  }
};

export default plugin;

