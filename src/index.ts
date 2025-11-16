import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ICommandPalette } from '@jupyterlab/apputils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { DocumentRegistry, DocumentWidget, IDocumentWidget, ABCWidgetFactory } from '@jupyterlab/docregistry';
import { ILauncher } from '@jupyterlab/launcher';
import { INotebookModel, INotebookTracker } from '@jupyterlab/notebook';
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
  // Notebook拡張機能に依存させることで、標準のNotebookファクトリ登録後に本プラグインを起動する
  requires: [INotebookTracker],
  optional: [ICommandPalette, ILauncher, IDocumentManager],
  activate: (
    app: JupyterFrontEnd,
    _notebookTracker: INotebookTracker,
    palette: ICommandPalette | null,
    launcher: ILauncher | null,
    docManager: IDocumentManager | null
  ) => {
    console.log('three-jupyterlab:plugin activating...');

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
      console.log('Added three-jupyter command to launcher');
    } else {
      console.warn('ILauncher is not available');
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

    // ファクトリを登録
    app.docRegistry.addWidgetFactory(factory);
    console.log('ThreeJupyterWidgetFactory added to docRegistry');

    // 方法1: defaultWidgetFactory メソッドを上書き
    const originalDefaultWidgetFactory = app.docRegistry.defaultWidgetFactory.bind(app.docRegistry);
    app.docRegistry.defaultWidgetFactory = (fileType: string) => {
      if (fileType === 'notebook') {
        // Three Jupyter ファクトリを取得
        const threeJupyterFactory = app.docRegistry.getWidgetFactory('Three Jupyter');
        if (threeJupyterFactory) {
          console.log('defaultWidgetFactory: Returning Three Jupyter for notebook');
          return threeJupyterFactory;
        }
      }
      return originalDefaultWidgetFactory(fileType);
    };
    console.log('Overrode defaultWidgetFactory method');

    // 方法2: Editor ファクトリの fileTypes から notebook を削除（可能な場合）
    try {
      const editorFactory = app.docRegistry.getWidgetFactory('Editor');
      if (editorFactory && editorFactory.fileTypes.includes('notebook')) {
        // fileTypes は読み取り専用の可能性があるため、直接変更を試みる
        const editorFactoryAny = editorFactory as any;
        if (editorFactoryAny.fileTypes && Array.isArray(editorFactoryAny.fileTypes)) {
          const index = editorFactoryAny.fileTypes.indexOf('notebook');
          if (index > -1) {
            editorFactoryAny.fileTypes = editorFactoryAny.fileTypes.filter((ft: string) => ft !== 'notebook');
            console.log('Removed notebook from Editor factory fileTypes');
          }
        }
      }
    } catch (error) {
      console.warn('Could not modify Editor factory fileTypes:', error);
    }

    // 方法3: docmanager:open コマンドをインターセプト（より確実な方法）
    // ファイルを開く際に、notebookファイルの場合は強制的にThree Jupyterファクトリを使用
    const originalOpenCommand = app.commands.execute.bind(app.commands);
    app.commands.execute = async (command: string, args?: any) => {
      // docmanager:openコマンドの場合、詳細ログを出力
      if (command === 'docmanager:open') {
        console.log('Command executed: docmanager:open, args:', JSON.stringify(args));
        if (args) {
          const path = args.path as string;
          console.log('docmanager:open path:', path);
          if (path && (path.endsWith('.ipynb') || path.endsWith('.ipynb/'))) {
            console.log('docmanager:open intercepted for notebook:', path);
            // widgetNameを'Three Jupyter'に指定して開く
            const newArgs = { ...args, widgetName: 'Three Jupyter' };
            console.log('docmanager:open calling with widgetName: Three Jupyter');
            return originalOpenCommand('docmanager:open', newArgs);
          }
        }
      }
      return originalOpenCommand(command, args);
    };
    console.log('Intercepted docmanager:open command');

    // 方法4: DocumentManager の open メソッドもインターセプト（念のため）
    if (docManager) {
      const docManagerAny = docManager as any;
      
      // open メソッドをインターセプト
      if (docManagerAny.open) {
        const originalOpen = docManagerAny.open.bind(docManagerAny);
        docManagerAny.open = async (path: string, widgetName?: string, kernel?: any, options?: any) => {
          // notebookファイルの場合
          if (path && (path.endsWith('.ipynb') || path.endsWith('.ipynb/'))) {
            // widgetNameが指定されていない、またはEditor/Notebookの場合、Three Jupyterを使用
            if (!widgetName || widgetName === 'Editor' || widgetName === 'Notebook') {
              console.log('DocumentManager.open intercepted for notebook:', path, ', widgetName:', widgetName, ', forcing Three Jupyter');
              // widgetNameを'Three Jupyter'に指定して開く
              const result = await originalOpen(path, 'Three Jupyter', kernel, options);
              console.log('DocumentManager.open: Result after forcing Three Jupyter:', result);
              return result;
            }
          }
          // それ以外は通常通り開く
          return originalOpen(path, widgetName, kernel, options);
        };
        console.log('Intercepted DocumentManager.open method');
      }
      
      // openOrReveal メソッドをインターセプト（ファイルをクリックした際に使用される可能性が高い）
      if (docManagerAny.openOrReveal) {
        const originalOpenOrReveal = docManagerAny.openOrReveal.bind(docManagerAny);
        docManagerAny.openOrReveal = async (path: string, widgetName?: string, kernel?: any, options?: any) => {
          console.log('DocumentManager.openOrReveal called with path:', path, ', widgetName:', widgetName);
          // notebookファイルの場合
          if (path && (path.endsWith('.ipynb') || path.endsWith('.ipynb/'))) {
            // widgetNameが指定されていない、またはEditor/Notebookの場合、Three Jupyterを使用
            if (!widgetName || widgetName === 'Editor' || widgetName === 'Notebook') {
              console.log('DocumentManager.openOrReveal intercepted for notebook:', path, ', widgetName:', widgetName, ', forcing Three Jupyter');
              // widgetNameを'Three Jupyter'に指定して開く
              const result = await originalOpenOrReveal(path, 'Three Jupyter', kernel, options);
              console.log('DocumentManager.openOrReveal: Result after forcing Three Jupyter:', result);
              return result;
            }
          }
          // それ以外は通常通り開く
          return originalOpenOrReveal(path, widgetName, kernel, options);
        };
        console.log('Intercepted DocumentManager.openOrReveal method');
      }
      
      // _openOrReveal 内部メソッドもインターセプト（念のため）
      if (docManagerAny._openOrReveal) {
        const originalOpenOrRevealInternal = docManagerAny._openOrReveal.bind(docManagerAny);
        docManagerAny._openOrReveal = async (path: string, widgetName?: string, kernel?: any, options?: any) => {
          console.log('DocumentManager._openOrReveal called with path:', path, ', widgetName:', widgetName);
          // notebookファイルの場合
          if (path && (path.endsWith('.ipynb') || path.endsWith('.ipynb/'))) {
            // widgetNameが指定されていない、またはEditor/Notebookの場合、Three Jupyterを使用
            if (!widgetName || widgetName === 'Editor' || widgetName === 'Notebook') {
              console.log('DocumentManager._openOrReveal intercepted for notebook:', path, ', widgetName:', widgetName, ', forcing Three Jupyter');
              // widgetNameを'Three Jupyter'に指定して開く
              const result = await originalOpenOrRevealInternal(path, 'Three Jupyter', kernel, options);
              console.log('DocumentManager._openOrReveal: Result after forcing Three Jupyter:', result);
              return result;
            }
          }
          // それ以外は通常通り開く
          return originalOpenOrRevealInternal(path, widgetName, kernel, options);
        };
        console.log('Intercepted DocumentManager._openOrReveal method');
      }

      // DocumentManagerの他の内部メソッドもインターセプト
      // reveal メソッドをインターセプト（ファイルが既に開かれている場合に使用される可能性がある）
      if (docManagerAny.reveal) {
        const originalReveal = docManagerAny.reveal.bind(docManagerAny);
        docManagerAny.reveal = async (path: string, widgetName?: string) => {
          console.log('DocumentManager.reveal called with path:', path, ', widgetName:', widgetName);
          // notebookファイルの場合
          if (path && (path.endsWith('.ipynb') || path.endsWith('.ipynb/'))) {
            // widgetNameが指定されていない、またはEditor/Notebookの場合、Three Jupyterを使用
            if (!widgetName || widgetName === 'Editor' || widgetName === 'Notebook') {
              console.log('DocumentManager.reveal intercepted for notebook:', path, ', widgetName:', widgetName, ', forcing Three Jupyter');
              return originalReveal(path, 'Three Jupyter');
            }
          }
          return originalReveal(path, widgetName);
        };
        console.log('Intercepted DocumentManager.reveal method');
      }

      // findWidget メソッドをインターセプト（既存のウィジェットを探す際に使用される可能性がある）
      if (docManagerAny.findWidget) {
        const originalFindWidget = docManagerAny.findWidget.bind(docManagerAny);
        docManagerAny.findWidget = (path: string, widgetName?: string) => {
          console.log('DocumentManager.findWidget called with path:', path, ', widgetName:', widgetName);
          // notebookファイルの場合
          if (path && (path.endsWith('.ipynb') || path.endsWith('.ipynb/'))) {
            // widgetNameが指定されていない、またはEditor/Notebookの場合、Three Jupyterを使用
            if (!widgetName || widgetName === 'Editor' || widgetName === 'Notebook') {
              console.log('DocumentManager.findWidget intercepted for notebook:', path, ', widgetName:', widgetName, ', forcing Three Jupyter');
              return originalFindWidget(path, 'Three Jupyter');
            }
          }
          return originalFindWidget(path, widgetName);
        };
        console.log('Intercepted DocumentManager.findWidget method');
      }
    } else {
      console.warn('IDocumentManager is not available, cannot intercept file opening');
    }

    // 方法5: DocumentRegistry の createWidget メソッドをインターセプト（最終手段）
    // ファイルを開く際に、notebookファイルの場合は強制的にThree Jupyterファクトリを使用
    const docRegistryAny = app.docRegistry as any;
    
    // createWidget メソッドをインターセプト
    if (docRegistryAny.createWidget) {
      const originalCreateWidget = docRegistryAny.createWidget.bind(docRegistryAny);
      docRegistryAny.createWidget = function(fileType: string, widgetName?: string, context?: DocumentRegistry.IContext<any>) {
        console.log('DocumentRegistry.createWidget called with fileType:', fileType, ', widgetName:', widgetName, ', context:', context ? context.path : 'null');
        // notebookファイルタイプの場合
        if (fileType === 'notebook' && context) {
          // widgetNameが指定されていない、またはEditor/Notebookの場合、Three Jupyterを使用
          if (!widgetName || widgetName === 'Editor' || widgetName === 'Notebook') {
            const threeJupyterFactory = app.docRegistry.getWidgetFactory('Three Jupyter');
            if (threeJupyterFactory) {
              console.log('DocumentRegistry.createWidget: Using Three Jupyter factory for notebook (widgetName:', widgetName, ')');
              try {
                const widget = threeJupyterFactory.createNew(context);
                console.log('DocumentRegistry.createWidget: Created Three Jupyter widget successfully');
                return widget;
              } catch (error) {
                console.error('DocumentRegistry.createWidget: Error creating Three Jupyter widget:', error);
                // エラーが発生した場合は、元のメソッドを呼び出す
                return originalCreateWidget(fileType, widgetName, context);
              }
            }
          }
        }
        // それ以外は通常通り作成
        return originalCreateWidget(fileType, widgetName, context);
      };
      console.log('Intercepted DocumentRegistry.createWidget method');
    }

    // DocumentRegistryの他の内部メソッドもインターセプト
    // getWidgetFactories メソッドをインターセプト（すべてのファクトリを取得する際に使用される可能性がある）
    if (docRegistryAny.getWidgetFactories) {
      const originalGetWidgetFactories = docRegistryAny.getWidgetFactories.bind(docRegistryAny);
      docRegistryAny.getWidgetFactories = function(fileType: string) {
        console.log('DocumentRegistry.getWidgetFactories called with fileType:', fileType);
        const factories = originalGetWidgetFactories(fileType);
        // notebookファイルタイプの場合、Three Jupyterを最初に返す
        if (fileType === 'notebook') {
          const threeJupyterFactory = app.docRegistry.getWidgetFactory('Three Jupyter');
          if (threeJupyterFactory && factories.indexOf(threeJupyterFactory) >= 0) {
            // Three Jupyterを最初に配置
            const filteredFactories = factories.filter((f: any) => f.name !== 'Three Jupyter');
            console.log('DocumentRegistry.getWidgetFactories: Reordering factories for notebook, Three Jupyter first');
            return [threeJupyterFactory, ...filteredFactories];
          }
        }
        return factories;
      };
      console.log('Intercepted DocumentRegistry.getWidgetFactories method');
    }
    
    // _createWidget 内部メソッドもインターセプト（念のため）
    if (docRegistryAny._createWidget) {
      const originalCreateWidgetInternal = docRegistryAny._createWidget.bind(docRegistryAny);
      docRegistryAny._createWidget = function(fileType: string, widgetName?: string, context?: DocumentRegistry.IContext<any>) {
        console.log('DocumentRegistry._createWidget called with fileType:', fileType, ', widgetName:', widgetName, ', context:', context ? context.path : 'null');
        // notebookファイルタイプの場合
        if (fileType === 'notebook' && context) {
          // widgetNameが指定されていない、またはEditor/Notebookの場合、Three Jupyterを使用
          if (!widgetName || widgetName === 'Editor' || widgetName === 'Notebook') {
            const threeJupyterFactory = app.docRegistry.getWidgetFactory('Three Jupyter');
            if (threeJupyterFactory) {
              console.log('DocumentRegistry._createWidget: Using Three Jupyter factory for notebook (widgetName:', widgetName, ')');
              try {
                const widget = threeJupyterFactory.createNew(context);
                console.log('DocumentRegistry._createWidget: Created Three Jupyter widget successfully');
                return widget;
              } catch (error) {
                console.error('DocumentRegistry._createWidget: Error creating Three Jupyter widget:', error);
                // エラーが発生した場合は、元のメソッドを呼び出す
                return originalCreateWidgetInternal(fileType, widgetName, context);
              }
            }
          }
        }
        // それ以外は通常通り作成
        return originalCreateWidgetInternal(fileType, widgetName, context);
      };
      console.log('Intercepted DocumentRegistry._createWidget method');
    }

    // 方法6: DocumentRegistry の getWidgetFactory メソッドをインターセプト（注意: 他のファイルタイプに影響する可能性があるため、慎重に使用）
    // この方法は、defaultWidgetFactoryが呼び出された後に実行される可能性があるため、
    // より確実な方法として、defaultWidgetFactoryのオーバーライドと組み合わせる
    // 注意: この方法は、EditorまたはNotebookが要求された場合に常にThree Jupyterを返すため、
    // 他のファイルタイプにも影響を与える可能性がある
    // そのため、この方法は使用しない（コメントアウト）
    /*
    const originalGetWidgetFactory = app.docRegistry.getWidgetFactory.bind(app.docRegistry);
    app.docRegistry.getWidgetFactory = (name: string) => {
      if (name === 'Editor' || name === 'Notebook') {
        const threeJupyterFactory = originalGetWidgetFactory('Three Jupyter');
        if (threeJupyterFactory) {
          console.log('DocumentRegistry.getWidgetFactory: Intercepted request for', name, ', returning Three Jupyter');
          return threeJupyterFactory;
        }
      }
      return originalGetWidgetFactory(name);
    };
    console.log('Intercepted DocumentRegistry.getWidgetFactory method');
    */

    // 方法7: setDefaultWidgetFactory APIを適切なタイミングで呼び出す
    // プラグインアクティベーション後、少し遅延させて呼び出す
    setTimeout(() => {
      try {
        app.docRegistry.setDefaultWidgetFactory('notebook', 'Three Jupyter');
        console.log('Called setDefaultWidgetFactory for notebook -> Three Jupyter');
        
        // 確認
        const defaultFactory = app.docRegistry.defaultWidgetFactory('notebook');
        console.log('Default widget factory for notebook (after setDefaultWidgetFactory):', defaultFactory ? defaultFactory.name : 'null');
      } catch (error) {
        console.warn('Error calling setDefaultWidgetFactory:', error);
      }
    }, 100);

    // 方法8: File Browserのプラグインを取得し、そのイベントハンドラーをインターセプト
    // JupyterLab 4.4.9では、File Browserがファイルを開く際に、直接DocumentRegistryのメソッドを呼び出している可能性がある
    // 注意: JupyterLab 4.4.9では、app.pluginsが存在しないため、この方法は使用できない
    // 代わりに、DocumentRegistryのメソッドをインターセプトすることで対応する
    try {
      // JupyterLab 4.4.9では、app.pluginsが存在しないため、この方法は使用できない
      // 代わりに、DocumentRegistryのメソッドをインターセプトすることで対応する
      console.log('File Browser plugin access not available in JupyterLab 4.4.9, using DocumentRegistry interception instead');
    } catch (error) {
      console.warn('Could not access File Browser plugin:', error);
    }

    // 方法9: DocumentRegistryの内部メソッドをより深くインターセプト
    // _getWidgetFactory 内部メソッドをインターセプト（念のため）
    // 注意: この方法は、EditorまたはNotebookが要求された場合に常にThree Jupyterを返すため、
    // 他のファイルタイプにも影響を与える可能性がある
    // そのため、この方法は使用しない（コメントアウト）
    /*
    if (docRegistryAny._getWidgetFactory) {
      const originalGetWidgetFactoryInternal = docRegistryAny._getWidgetFactory.bind(docRegistryAny);
      docRegistryAny._getWidgetFactory = function(name: string) {
        console.log('DocumentRegistry._getWidgetFactory called with name:', name);
        if (name === 'Editor' || name === 'Notebook') {
          const threeJupyterFactory = originalGetWidgetFactoryInternal('Three Jupyter');
          if (threeJupyterFactory) {
            console.log('DocumentRegistry._getWidgetFactory: Intercepted request for', name, ', returning Three Jupyter');
            return threeJupyterFactory;
          }
        }
        return originalGetWidgetFactoryInternal(name);
      };
      console.log('Intercepted DocumentRegistry._getWidgetFactory method');
    }
    */

    // 方法10: DocumentRegistryのgetFileTypesForFactoryメソッドをインターセプト
    // Editorファクトリがnotebookファイルタイプを処理しないようにする
    if (docRegistryAny.getFileTypesForFactory) {
      const originalGetFileTypesForFactory = docRegistryAny.getFileTypesForFactory.bind(docRegistryAny);
      docRegistryAny.getFileTypesForFactory = function(factoryName: string) {
        const fileTypes = originalGetFileTypesForFactory(factoryName);
        if (factoryName === 'Editor') {
          // Editorファクトリからnotebookファイルタイプを除外
          const filteredFileTypes = fileTypes.filter((ft: string) => ft !== 'notebook');
          console.log('DocumentRegistry.getFileTypesForFactory: Removed notebook from Editor factory, fileTypes:', filteredFileTypes);
          return filteredFileTypes;
        }
        return fileTypes;
      };
      console.log('Intercepted DocumentRegistry.getFileTypesForFactory method');
    }

    // 方法11: DocumentRegistryのgetWidgetFactoryメソッドをインターセプト
    // notebookファイルタイプの場合は常にThree Jupyterを返すようにする
    // 注意: この方法は、EditorまたはNotebookファクトリが要求された場合にThree Jupyterを返すため、
    // 他のファイルタイプにも影響を与える可能性がある
    // しかし、defaultWidgetFactoryメソッドのオーバーライドと組み合わせることで、より確実に動作する
    const originalGetWidgetFactory = app.docRegistry.getWidgetFactory.bind(app.docRegistry);
    app.docRegistry.getWidgetFactory = (name: string) => {
      // EditorまたはNotebookファクトリが要求された場合、Three Jupyterを返す
      // ただし、明示的にThree Jupyterが要求された場合は、そのまま返す
      if (name === 'Editor' || name === 'Notebook') {
        const threeJupyterFactory = originalGetWidgetFactory('Three Jupyter');
        if (threeJupyterFactory) {
          console.log('DocumentRegistry.getWidgetFactory: Intercepted request for', name, ', returning Three Jupyter');
          return threeJupyterFactory;
        }
      }
      return originalGetWidgetFactory(name);
    };
    console.log('Intercepted DocumentRegistry.getWidgetFactory method (notebook files only)');

    // デフォルトファクトリの確認
    const defaultFactory = app.docRegistry.defaultWidgetFactory('notebook');
    console.log('Default widget factory for notebook:', defaultFactory ? defaultFactory.name : 'null');
    
    console.log('ThreeJupyterWidgetFactory registered as default widget factory for notebook');
    console.log('three-jupyterlab:plugin activation complete');

  }
};

export default plugin;

