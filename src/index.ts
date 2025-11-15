import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ICommandPalette, MainAreaWidget } from '@jupyterlab/apputils';
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

    // コマンドを登録
    const command = 'three-jupyterlab:open';
    app.commands.addCommand(command, {
      label: 'Three Jupyter を開く',
      caption: 'カスタムUIでPythonコードを実行',
      execute: () => {
        // ウィジェットを作成
        const content = new ThreeJupyterWidget();
        const widget = new MainAreaWidget<ThreeJupyterWidget>({ content });
        widget.id = 'three-jupyterlab';
        widget.title.label = 'Three Jupyter';
        widget.title.closable = true;

        // ウィジェットを追加
        app.shell.add(widget, 'main');
      }
    });

    // コマンドパレットに追加
    if (palette) {
      palette.addItem({ command, category: 'Three Jupyter' });
    }
  }
};

export default plugin;

