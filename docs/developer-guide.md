# three-JupyterLab 開発者ガイド

## プロジェクト概要

`three-JupyterLab`は、JupyterLab拡張機能として実装されたアプリケーションです。

Three.jsを使用して3Dシーンを表示し、その上にフローティングウィンドウシステムでJupyterセルを操作できます。

## セットアップ

### 前提条件

- Node.js (v18 以上)
- Python (v3.8 以上)
- JupyterLab (v4.0 以上)

### 0. 初回セットアップ（重要）

**JupyterLab 4.0以降では、拡張機能を有効にするためにPythonパッケージのインストールが必要です。**

以下のコマンドを実行してPythonパッケージをインストールしてください：

```powershell
pip install -e .
```

これにより、`setup.py`に記載されている依存関係（JupyterLab、jupyter-packaging）もインストールされます。

**注意**: `jupyter labextension develop` コマンドが動作しない場合があります。その場合は、以下の手順を実行してください：

1. 拡張機能をビルド：
```powershell
npm run build
```

2. 拡張機能を手動でインストール：
```powershell
# JupyterLabの拡張機能ディレクトリを取得
$jupyterPath = python -c "import jupyterlab; import os; print(os.path.join(os.path.dirname(jupyterlab.__file__), '..', '..', 'share', 'jupyter', 'labextensions'))"
$dest = Join-Path $jupyterPath "three-jupyterlab"

# 拡張機能ディレクトリを作成
New-Item -ItemType Directory -Path $dest -Force

# 拡張機能ファイルをコピー
Copy-Item -Path "three_jupyterlab\labextension\*" -Destination $dest -Recurse -Force

# install.jsonをコピー
Copy-Item -Path "install.json" -Destination "$dest\install.json" -Force
```

3. JupyterLabを再ビルド：
```powershell
jupyter lab build --dev-build
```

### 1. 依存関係のインストール

```powershell
npm install
```

または

```powershell
jlpm install
```

### 2. 開発環境の起動（推奨）

**初回のみ（開発モードでインストール）:**

```powershell
npm run dev
```

**注意**: `npm run dev` を実行した際に `jupyter labextension develop` がエラーになる場合があります。その場合は、上記の「0. 初回セットアップ」の手動インストール手順を実行してください。

**2回目以降（開発モードインストール済みの場合）:**

```powershell
npm run dev:quick
```

これで、ビルド → JupyterLab起動が一度のコマンドで実行されます。

### 3. 本番モードでの起動

```powershell
npm run start
```

### 4. 手動でのセットアップ（従来の方法）

拡張のビルド:

```powershell
npm run build
```

開発モードでインストール:

```powershell
jupyter labextension develop --overwrite .
```

本番モードでインストール:

```powershell
jupyter labextension install .
```

JupyterLabの起動:

```powershell
jupyter lab
```

## 開発

### クイックスタート

**開発モードで起動（初回のみ）:**

```powershell
npm run dev
```

**開発モードで起動（2回目以降）:**

```powershell
npm run dev:quick
```

### ビルドスクリプト

- `npm run build` - 開発用ビルド（ソースマップ有効）
- `npm run build:prod` - 本番用ビルド（ソースマップ無効）
- `npm run watch` - TypeScriptのウォッチモード

### ウォッチモードでビルド

```powershell
npm run watch
```

別のターミナルでJupyterLabを起動:

```powershell
jupyter lab --watch
```

### デバッグ

VS Code/CursorでF5を押すか、「実行とデバッグ」から「Debug JupyterLab Extension」を選択すると、ブレークポイントを使ったデバッグが可能です。

詳細:
- `.vscode/launch.json` - デバッグ設定
- `tsconfig.json` - 開発用設定（`sourceMap: true`）
- `tsconfig.prod.json` - 本番用設定（`sourceMap: false`）

### クリーンアップ

```powershell
npm run clean
```

すべてをクリーンアップ:

```powershell
npm run clean:all
```

## アーキテクチャ

### ウィンドウタイプの対応関係

1. **`floating-editor-window`** (`src/components/floating-editor-window.tsx`)

   - Jupyterのコードセル（ソースコード編集）

   - Monaco Editorを使用してPythonコードを編集

   - Ctrl+Enterでコード実行

   - 初回実行時に自動的に`floating-output-window`を作成（既に存在する場合は作成しない、1:1の関係）

2. **`floating-output-window`** (`src/components/floating-output-window.tsx`)

   - Jupyterのセル出力を表示

   - テキスト、HTML、画像、エラーなど多様な出力形式に対応

   - エディタウィンドウと1:1で紐付けられている（`linkedWindowId`で管理）

   - エディタウィンドウを閉じると、関連する出力ウィンドウも自動的に閉じる

3. **`floating-markdown-window`** (`src/components/floating-markdown-window.tsx`)

   - Jupyterのマークダウンセル（編集・表示）

   - マークダウンをHTMLにレンダリングして表示

   - 編集モードとプレビューモードを切り替え可能

   - `marked`ライブラリを使用してレンダリング

### ディレクトリ構造

```
src/
├── index.ts                      # JupyterLab拡張のエントリーポイント
├── widget.tsx                    # メインReactコンポーネント（Three.jsシーンとウィンドウ管理）
├── scene-manager.ts              # Three.jsシーン、カメラ、レンダラーの管理
├── floating-window-manager.ts    # フローティングウィンドウのライフサイクル管理
├── components/
│   ├── floating-editor-window.tsx    # コードセルウィンドウ
│   ├── floating-output-window.tsx    # 出力ウィンドウ
│   └── floating-markdown-window.tsx  # マークダウンウィンドウ
└── services/
    └── floating-window-css2d.service.ts  # CSS2DRendererと3D空間への配置を管理
```

### 主要な実装詳細

- **ウィンドウ管理**: `FloatingWindowManager`クラスがウィンドウの作成、削除、位置・サイズ管理を担当

- **Kernel接続**: `@jupyterlab/services`の`KernelManager`を使用してJupyter Kernelに接続

- **Three.js統合**: `SceneManager`クラスがThree.jsのシーン、カメラ、レンダラーを管理。`CSS2DRenderer`を使用してフローティングウィンドウを3D空間に配置

- **ウィンドウ操作**: すべてのウィンドウでドラッグ、リサイズ、最小化、閉じる機能を実装

### 依存関係

- `three`: Three.js（3Dグラフィックス）

- `monaco-editor`: コードエディタ

- `marked`: マークダウンレンダリング

- `@jupyterlab/services`: Jupyter Kernel接続

- `react`, `react-dom`: UIコンポーネント

## プロジェクト構造

```
three-JupyterLab/
├── binder/
│   ├── environment.yml   # Binder用の環境設定
│   └── postBuild         # Binder用のビルドスクリプト
├── src/
│   ├── index.ts                      # JupyterLab拡張のエントリーポイント
│   ├── widget.tsx                    # メインReactコンポーネント（Three.jsシーンとウィンドウ管理）
│   ├── scene-manager.ts              # Three.jsシーン、カメラ、レンダラーの管理
│   ├── floating-window-manager.ts    # フローティングウィンドウのライフサイクル管理
│   ├── components/
│   │   ├── floating-editor-window.tsx    # コードセルウィンドウ
│   │   ├── floating-output-window.tsx    # 出力ウィンドウ
│   │   └── floating-markdown-window.tsx  # マークダウンウィンドウ
│   └── services/
│       └── floating-window-css2d.service.ts  # CSS2DRendererと3D空間への配置を管理
├── style/
│   └── index.css         # スタイル
├── lib/                  # ビルド出力（自動生成）
├── .vscode/              # VS Code/Cursorデバッグ設定
│   ├── launch.json       # デバッグ設定
│   └── tasks.json        # ビルドタスク
├── docs/                 # ドキュメント
│   ├── developer-guide.md
│   └── how-to-deploy-to-PyPI.md
├── package.json
├── tsconfig.json         # 開発用TypeScript設定（sourceMap: true）
├── tsconfig.prod.json    # 本番用TypeScript設定（sourceMap: false）
└── README.md
```

## 注意事項

- `home-screen.component.ts`は不要（削除済み）

- エディタウィンドウと出力ウィンドウは常に1:1の関係

- ウィンドウはCSS2DRendererを使用してThree.jsの3D空間に配置されている

## 参考実装

`BackcastPro-dashbord`プロジェクトの以下のファイルを参考に実装されています：

- `floating-editor-manager.component.ts`: ウィンドウ管理のアーキテクチャ

- `floating-editor-window.component.ts`: エディタウィンドウの実装パターン

- `floating-chart-window.component.ts`: 出力ウィンドウの実装パターン

## トラブルシューティング

### 拡張が表示されない場合

1. 拡張が正しくビルドされているか確認:
   ```powershell
   jlpm build
   ```

2. JupyterLabを再起動:
   ```powershell
   jupyter lab --clean
   ```

3. 拡張がインストールされているか確認:
   ```powershell
   jupyter labextension list
   ```

### Kernelが起動しない場合

- JupyterLabが正しくインストールされているか確認してください
- Pythonカーネルが利用可能か確認してください:
  ```powershell
  jupyter kernelspec list
  ```

