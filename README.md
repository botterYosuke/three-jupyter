# Three JupyterLab

JupyterLab拡張として実装された、カスタムUIでPythonコードを実行するアプリケーションです。

[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/botterYosuke/three-jupyter/HEAD)

## Binderで試す

この拡張機能をインストールしたJupyterLabをBinderで試すことができます：

1. 上記のBinderバッジをクリックするか、以下のURLにアクセス：
   ```
   https://mybinder.org/v2/gh/botterYosuke/three-jupyter/HEAD
   ```

2. Binderが環境を構築するまで数分待ちます（初回は時間がかかります）

3. JupyterLabが起動したら、コマンドパレット（`Ctrl+Shift+C`）を開き、"Three Jupyter を開く" を検索して実行します

## 機能

- JupyterLab拡張として統合
- JupyterLabのKernel APIを使用したPythonコード実行
- モダンなUIデザイン
- リアルタイムでの実行結果表示

## セットアップ

### 前提条件

- Node.js (v18 以上)
- Python (v3.8 以上)
- JupyterLab (v4.0 以上)

### 1. 依存関係のインストール

```powershell
cd C:\Users\sasai\Documents\three-JupyterLab
npm install
```

または

```powershell
jlpm install
```

### 2. 拡張のビルド

```powershell
jlpm build
```

### 3. JupyterLabへのインストール

開発モードでインストール:

```powershell
jupyter labextension develop --overwrite .
```

または、本番モードでインストール:

```powershell
jupyter labextension install .
```

### 4. JupyterLabの起動

```powershell
jupyter lab
```

## 使用方法

1. JupyterLabを起動します
2. コマンドパレット（`Ctrl+Shift+C`）を開きます
3. "Three Jupyter を開く" を検索して実行します
4. カスタムUIが開きます
5. コード入力欄にPythonコードを入力します
6. 「実行」ボタンをクリックしてコードを実行します
7. 実行結果が出力セクションに表示されます

## プロジェクト構造

```
three-JupyterLab/
├── binder/
│   ├── environment.yml   # Binder用の環境設定
│   └── postBuild         # Binder用のビルドスクリプト
├── src/
│   ├── index.ts          # 拡張のエントリーポイント
│   └── widget.tsx        # Reactコンポーネント
├── style/
│   └── index.css         # スタイル
├── lib/                  # ビルド出力（自動生成）
├── package.json
├── tsconfig.json
└── README.md
```

## 開発

### ウォッチモードでビルド

```powershell
jlpm watch
```

別のターミナルでJupyterLabを起動:

```powershell
jupyter lab --watch
```

### クリーンアップ

```powershell
jlpm clean
```

すべてをクリーンアップ:

```powershell
jlpm clean:all
```

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

