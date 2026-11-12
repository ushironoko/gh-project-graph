# gh-project-graph

GitHub Project（Projects v2）の Issue / PR を 1 件 1 枚のカードにして、関係を線でつなぎ、作成日時の横軸に沿って無限平面に並べるブラウザツール。

## 使い方

```sh
bun install
GITHUB_TOKEN="$(gh auth token)" bun run start
```

`http://127.0.0.1:5178` を開き、Project の URL（`https://github.com/orgs/OWNER/projects/N` / `https://github.com/users/OWNER/projects/N`）か `OWNER/N` を入力する。`?project=OWNER/N` を付けた URL は開いた時点で読み込まれる。

トークンは `GITHUB_TOKEN` → `GH_TOKEN` → `gh auth token` の順に探す。`read:project` と、対象リポジトリを読めるスコープが必要。

## 操作

| 操作 | 内容 |
| --- | --- |
| ドラッグ / ホイール | 平面を移動（Shift+ホイールで横移動） |
| ⌘ / Ctrl + ホイール、ピンチ | カーソル位置を中心に拡大縮小 |
| `F` / `+` / `-` | 全体表示 / 拡大 / 縮小 |
| カードをクリック | その場で展開し、詳細をその時点で取得（本文、ラベル、担当、Project フィールド、PR の差分・CI・レビュー、最新コメント、関係一覧） |
| `Esc` / 背景クリック | 展開を閉じる |
| 凡例ボタン | 関係の種類ごとに表示を切り替え |
| 時間スライダー | 横軸の密度を変更（初期値は画面の縦横比に合うよう自動選択） |
| 検索 | 一致しないカードを薄くし、Enter / Shift+Enter で一致したカードへ移動 |

## 線の種類

| 種類 | 取得元 | 向き |
| --- | --- | --- |
| ブロック | `Issue.blockedBy` / `Issue.blocking` | ブロックする側 → される側 |
| サブIssue | `Issue.parent` / `Issue.subIssues` | 親 → 子 |
| 関連 | `Issue.relatesTo` | 向きなし |
| 重複 | `Issue.duplicateOf` | 重複 → 元 |
| クローズ | `PullRequest.closingIssuesReferences` / `Issue.closedByPullRequestsReferences` | PR → Issue |
| ベースブランチ | PR の base ブランチが、同じリポジトリにある別 PR の head ブランチ（子 PR の作成時点で open だったもの） | 土台の PR → 載っている PR |
| スタックPR | `PullRequest.stack`（GitHub のスタック PR） | 下の段 → 上の段 |

Project に含まれないアイテムでも、Project 内のアイテムと関係があれば「外部」カード（破線枠）として表示する。

## 構成

- `server.ts` — `127.0.0.1` で `dist/` を配信し、`/api/graphql` を GitHub GraphQL API に中継する。中継するのは `src/shared/queries.ts` に定義した名前付きクエリのみで、Host / Origin が一致しないリクエストと JSON 以外のリクエストは拒否する
- `src/model` — API レスポンスからグラフ（ノード・エッジ）を作る処理と絞り込み
- `src/layout` — 時間軸の座標、連結成分ごとの行詰め、目盛り、時間スケールの自動選択
- `src/view` — ビューポートの座標変換、エッジの経路
- `src/components` — Vue SFC（vize でコンパイル）

本文の HTML は `allow-scripts` なしの sandbox iframe に CSP 付きで描画する。

## 開発

```sh
bun test
bun run check   # vize check
bun run lint    # vize lint
bun run fmt     # vize fmt
bun run build
```
