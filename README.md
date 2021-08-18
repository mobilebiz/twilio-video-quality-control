# Twilio Video パフォーマンステスト

Twilio Video のパフォーマンスをテストするためのサンプルプログラムです。

## インストール

### ソースコードの取得

```sh
git clone https://github.com/mobilebiz/twilio-video-quality-control
cd twilio-video-quality-control
```

### Twilio 側の設定

Twilio 側は以下の作業が必要です。

- CLI のインストール
- プロファイルの作成
- API キーの作成

### 環境ファイルの設定

`.env.sample`を`.env`にコピーして、以下の内容を設定してください。

| 項目        | 説明                                           |
| :---------- | :--------------------------------------------- |
| ACCOUNT_SID | Twilio のアカウント SID（AC から始まる文字列） |
| AUTH_TOKEN  | 設定は不要です                                 |
| API_KEY     | 上記で作成した API Key（SK から始まる文字列）  |
| API_SECRET  | API Key とペアで作成された文字列               |

## デプロイ

アクセストークン生成 Function を以下のコマンドで Twilio 上にデプロイします。

```sh
npm run deploy
```

## ローカルテスト

ローカルホストのポート 3000 を使ってプログラムを起動させます。  
上記のデプロイがされている必要があります。

```sh
npm run start
```

## ngrok で外部公開

```sh
ngrok http 3000
```

設定された URL を使って、以下でテストができるはずです(xxxxxxxx の部分は払い出された値に変えてください)。

`https://xxxxxxxx.ngrok.io/video.html`

## パラメータ

`assets/video.js`の中に、以下の行があります。

```javascript
const tuning = true; // チューニング（true: する、false: しない）
const preflight = true; // 事前環境確認（true: する、false: しない）
const tcpForced = true; // TURN(TCP:443)の利用を強制（true: する、false: しない）
```

それぞれを変更してテストしてください。

## preflight の結果判定

preflight を true にした場合、以下のようなテスト結果が表示されます。

```text
Your network jitter was: {
  "min": 0.001,
  "max": 0.002,
  "average": 0.0016
}.
Your network rtt was: {
  "min": 13,
  "max": 13,
  "average": 13
}.
Your network packetLoss was: {
  "min": 0,
  "max": 0,
  "average": 0
```

jitter は、パケットのゆらぎを表しており、値が小さい方がネットワーク環境が良いです。通常 0.03(単位は秒) より小さくなることが望ましいです。  
rtt は、遅延を表しており、こちらも値が小さい方が良いです。通常、200(単位はミリ秒) より小さくなることが望ましいです。  
packetLoss は、その名の通り、パケット欠損を表しており、通常は 3(単位は％) より小さくなることが望ましいです。

## tcpForced の効果

このフラグは、Twilio Video のネゴシエーション時に、turn サーバーの利用を強制するものです。  
具体的には、TCP/443 ポートを利用するようにするため、ファイアウォールなどにより UDP がブロックされていたり、TCP の特定ポート以外がブロックされている場合でもビデオ通話ができる可能性があります。
