import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ICommandPalette, MainAreaWidget } from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';
import { ThreeJupyterWidget } from './widget';

/**
 * Initialization data for the three-jupyterlab extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'three-jupyterlab:plugin',
  description: 'JupyterLab extension with custom UI for Python code execution',
  autoStart: true,
  optional: [ICommandPalette],
  activate: (app: JupyterFrontEnd, palette: ICommandPalette | null) => {
    console.log('JupyterLab extension three-jupyterlab is activated!');

    // ウィジェットを作成する関数
    const createWidget = () => {
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

        // ウィジェットを作成
        const content = new ThreeJupyterWidget();
        const widget = new MainAreaWidget<ThreeJupyterWidget>({ content });
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

