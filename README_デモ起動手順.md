# PITBRAIN デモ環境 起動手順

## 必要なもの

**Docker Desktop**（無料）のみ
https://www.docker.com/products/docker-desktop/

---

## 起動方法

1. **Docker Desktop を起動**して、タスクバーのアイコンが緑になるまで待つ
2. `起動.bat` をダブルクリック
3. 初回は自動でビルド（5〜10分程度）
4. `Application startup complete.` が表示されたら準備完了
5. ブラウザで **http://localhost:3001** を開く

## 停止方法

`停止.bat` をダブルクリック

---

## ログインアカウント一覧

パスワードはすべて共通：**password123**

| 役割 | メールアドレス |
|------|--------------|
| オーナー | admin@avarth.co.jp |
| 一次代理店（安全自動車） | sasaki@anzen-auto.co.jp |
| 一次代理店（西日本オート） | yamaguchi@nishiauto.co.jp |
| 二次代理店（東日本商事） | suzuki@higashi-shoji.co.jp |
| 整備会社（山田自動車整備） | yamada@yamada-auto.co.jp |
| 整備会社（鈴木モータース） | suzuki@suzuki-motors.co.jp |
| 整備会社（田中自動車工業） | tanaka@tanaka-auto.co.jp |
| 整備会社（佐藤整備工場） | sato@sato-garage.co.jp |

---

## 会社階層構造

```
AB                       アバルト株式会社（オーナー）
├── AB-A01               安全自動車株式会社（一次代理店）
│   ├── AB-A01-B01       東日本商事株式会社（二次代理店）
│   │   ├── AB-A01-B01-S01   山田自動車整備株式会社
│   │   │   ├── AB-A01-B01-S01-P01  本店
│   │   │   └── AB-A01-B01-S01-P02  横浜支店
│   │   └── AB-A01-B01-S02   鈴木モータース株式会社
│   └── AB-A01-S01       田中自動車工業株式会社
└── AB-A02               西日本オート株式会社（一次代理店）
    └── AB-A02-S01       佐藤整備工場
```

---

## 注意事項

- このデモ環境は評価専用です。本番環境とは完全に分離されています。
- データの変更・追加は自由にお試しいただけます。
- 2回目以降の起動はビルド済みのため1分以内に起動します。
