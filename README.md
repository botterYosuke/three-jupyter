# Three Jupyter

Jupyter Server + Jupyter Kernel Gateway を使用した、Angular で完全に UI を自作したサンプルアプリケーションです。

## 機能

- Jupyter Kernel の起動・停止
- Python コードの実行
- 実行結果の表示
- モダンな UI デザイン

## セットアップ

### 前提条件

- Node.js (v18 以上)
- Python (v3.8 以上)
- npm または yarn

### 1. Python 依存関係のインストール

```powershell
pip install -r requirements.txt
```

### 2. Angular 依存関係のインストール

```powershell
npm install
```

## 実行方法

### 1. Jupyter Kernel Gateway の起動

ターミナル 1 で以下を実行:

```powershell
jupyter kernelgateway --config=jupyter_kernel_gateway_config.py
```

Kernel Gateway が `http://127.0.0.1:8889` で起動します。

### 2. Angular アプリケーションの起動

ターミナル 2 で以下を実行:

```powershell
npm start
```

または

```powershell
ng serve
```

Angular アプリケーションが `http://localhost:4200` で起動します。

### 3. ブラウザでアクセス

ブラウザで `http://localhost:4200` を開いてください。

## 使用方法

1. アプリケーションを開くと、自動的に Kernel が起動します
2. コード入力欄に Python コードを入力します
3. 「実行」ボタンをクリックしてコードを実行します
4. 実行結果が出力セクションに表示されます

## プロジェクト構造

```
three-jupyter/
├── src/
│   ├── app/
│   │   ├── app.component.ts      # メインコンポーネント
│   │   ├── app.component.html     # テンプレート
│   │   ├── app.component.css      # スタイル
│   │   └── jupyter.service.ts     # Jupyter 通信サービス
│   ├── index.html
│   ├── main.ts
│   └── styles.css
├── jupyter_server_config.py       # Jupyter Server 設定
├── jupyter_kernel_gateway_config.py  # Kernel Gateway 設定
├── package.json
├── requirements.txt
└── README.md
```

## 注意事項

- Kernel Gateway は先に起動しておく必要があります
- CORS エラーが発生する場合は、Kernel Gateway の設定を確認してください
- 開発環境でのみ使用してください（本番環境では適切なセキュリティ設定が必要です）

## トラブルシューティング

### Kernel が起動しない場合

- Kernel Gateway が正しく起動しているか確認してください
- `http://127.0.0.1:8889/api/kernels` にアクセスして、API が利用可能か確認してください

### CORS エラーが発生する場合

`jupyter_kernel_gateway_config.py` の設定を確認してください:

```python
c.KernelGatewayApp.allow_origin = '*'
c.KernelGatewayApp.allow_headers = '*'
c.KernelGatewayApp.allow_methods = '*'
```

## ライセンス

MIT

