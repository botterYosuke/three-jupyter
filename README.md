# three-JupyterLab プロジェクト説明

## プロジェクト概要

`three-JupyterLab`は、JupyterLab拡張機能として実装されたアプリケーションです。

Three.jsを使用して3Dシーンを表示し、その上にフローティングウィンドウシステムでJupyterセルを操作できます。

[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/botterYosuke/three-jupyter/HEAD)

## Binderで試す

この拡張機能をインストールしたJupyterLabをBinderで試すことができます：

1. 上記のBinderバッジをクリックするか、以下のURLにアクセス：
   ```
   https://mybinder.org/v2/gh/botterYosuke/three-jupyter/HEAD
   ```

2. Binderが環境を構築するまで数分待ちます（初回は時間がかかります）

3. JupyterLabが起動したら、コマンドパレット（`Ctrl+Shift+C`）を開き、"Three Jupyter を開く" を検索して実行します

## 主要機能

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

### アーキテクチャ

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

## セットアップ

### 前提条件

- Node.js (v18 以上)
- Python (v3.8 以上)
- JupyterLab (v4.0 以上)

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

**2回目以降（開発モードインストール済みの場合）:**

```powershell
npm run dev:quick
```

これで、ビルド → インストール → JupyterLab起動が一度のコマンドで実行されます。

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

## 使用方法

1. ツールバーの「+」ボタンでコードセルを作成

2. ツールバーの「i」ボタンでマークダウンセルを作成

3. エディタウィンドウでコードを実行すると、自動的に出力ウィンドウが作成される

4. すべてのウィンドウはドラッグ・リサイズ可能

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
├── package.json
├── tsconfig.json         # 開発用TypeScript設定（sourceMap: true）
├── tsconfig.prod.json    # 本番用TypeScript設定（sourceMap: false）
└── README.md
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

### 注意事項

- `home-screen.component.ts`は不要（削除済み）

- エディタウィンドウと出力ウィンドウは常に1:1の関係

- ウィンドウはCSS2DRendererを使用してThree.jsの3D空間に配置されている

### 参考実装

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

## ライセンス

MIT

