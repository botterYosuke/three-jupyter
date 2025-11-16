# <img src="https://raw.githubusercontent.com/botterYosuke/three-jupyter/main/docs/img/logo.drawio.svg" alt="three-jupyter Logo" width="24" height="24"> three-JupyterLab

JupyterLab拡張機能として実装されたアプリケーション。Three.jsを使用して3Dシーンを表示し、その上にフローティングウィンドウシステムでJupyterセルを操作できます。

[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/botterYosuke/three-jupyter/HEAD)

## インストール（Windows）

### PyPIから（エンドユーザー向け）

```powershell
python -m pip install three-jupyterlab
```

インストール後、JupyterLabを再起動してください：

```powershell
jupyter lab
```

### 開発用インストール

開発用に、リポジトリをクローンして開発モードでインストールします。

```powershell
git clone https://github.com/botterYosuke/three-jupyter.git
cd three-jupyter
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e .
```

**開発モードインストール（python -m pip install -e .）**
- プロジェクトを開発モードでインストールします
- 詳細な開発手順は[開発者ガイド](docs/developer-guide.md)をご参照ください

## Binderで試す

この拡張機能をインストールしたJupyterLabをBinderで試すことができます：

1. 上記のBinderバッジをクリックするか、以下のURLにアクセス：
   ```
   https://mybinder.org/v2/gh/botterYosuke/three-jupyter/HEAD
   ```

2. Binderが環境を構築するまで数分待ちます（初回は時間がかかります）

3. JupyterLabが起動したら、コマンドパレット（`Ctrl+Shift+C`）を開き、"Three Jupyter を開く" を検索して実行します

## 使用方法

1. ツールバーの「+」ボタンでコードセルを作成

2. ツールバーの「i」ボタンでマークダウンセルを作成

3. エディタウィンドウでコードを実行すると、自動的に出力ウィンドウが作成される

4. すべてのウィンドウはドラッグ・リサイズ可能

## 主要機能

### ウィンドウタイプ

1. **コードセルウィンドウ** - Monaco Editorを使用してPythonコードを編集・実行
2. **出力ウィンドウ** - セルの実行結果を表示（テキスト、HTML、画像、エラーなど）
3. **マークダウンセルウィンドウ** - マークダウンの編集・表示

すべてのウィンドウは3D空間に配置され、ドラッグ・リサイズ・最小化が可能です。

## ドキュメント

- [開発者ガイド](docs/developer-guide.md) - セットアップ、開発方法、アーキテクチャの詳細
- [PyPIへのデプロイ方法](docs/how-to-deploy-to-PyPI.md)

## バグ報告 / サポート

- バグ報告や要望は [GitHub Issues](https://github.com/botterYosuke/three-jupyter/issues) へ
- 質問は Discord コミュニティへ（[招待リンク](https://discord.gg/T4KacBFh)）
- 使い方はドキュメントをご参照ください

## ライセンス

MIT
