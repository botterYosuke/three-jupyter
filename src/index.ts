import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ICommandPalette } from '@jupyterlab/apputils';
import { DocumentRegistry, DocumentWidget, IDocumentWidget, ABCWidgetFactory } from '@jupyterlab/docregistry';
import { ILauncher } from '@jupyterlab/launcher';
import { INotebookModel } from '@jupyterlab/notebook';
import { Widget } from '@lumino/widgets';
import { circleIcon } from '@jupyterlab/ui-components';
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

    // 保存コマンドを登録
    const saveCommand = 'three-jupyterlab:save';
    app.commands.addCommand(saveCommand, {
      label: '保存',
      caption: 'Notebookファイルを上書き保存',
      execute: async () => {
        try {
          // 現在アクティブなウィジェットを取得
          const currentWidget = app.shell.currentWidget;
          if (currentWidget && currentWidget.id && currentWidget.id.startsWith('three-jupyterlab-')) {
            // ThreeJupyterWidgetのsaveメソッドを呼び出す
            const threeWidget = currentWidget as any;
            if (threeWidget.content && typeof threeWidget.content.save === 'function') {
              await threeWidget.content.save();
            } else if (threeWidget.save && typeof threeWidget.save === 'function') {
              await threeWidget.save();
            } else {
              // フォールバック: docmanager:saveコマンドを使用
              await app.commands.execute('docmanager:save');
            }
          } else {
            // フォールバック: docmanager:saveコマンドを使用
            await app.commands.execute('docmanager:save');
          }
        } catch (error) {
          console.error('Error saving notebook:', error);
          if (error instanceof Error) {
            console.error('Error message:', error.message);
          }
        }
      }
    });

    // Ctrl+Sキーバインドを追加
    app.commands.addKeyBinding({
      command: saveCommand,
      keys: ['Accel S'],
      selector: '.three-jupyter-widget'
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
        
        // 未保存状態の時に×ボタンを●に変更
        const updateDirtyState = () => {
          if (context.model.dirty) {
            // 未保存状態の時は●アイコンを表示
            widget.title.icon = circleIcon;
            widget.title.iconClass = 'jp-mod-dirty';
          } else {
            // 保存済みの時はアイコンをクリア
            widget.title.icon = undefined;
            widget.title.iconClass = '';
          }
        };
        
        // 初期状態を設定
        updateDirtyState();
        
        // dirty状態の変更を監視（context.modelのdirtyプロパティの変更を監視）
        context.model.stateChanged.connect((model, change) => {
          if (change.name === 'dirty') {
            updateDirtyState();
          }
        });
        
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

  }
};

export default plugin;

