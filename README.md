# NEON//TERMINAL — mobil

Telefonda çalışan, neon/CRT görünümlü kripto analiz terminali. Bir coin yaz (`btc`, `solana`, `init`, `INITUSDT`, `ETH-USD`), Enter'a bas; 11 adımlık day-trader analizi tarayıcının içinde çalışır ve sonuç panoya dökülür.

**Canlı sayfa:** https://twitter67433-oss.github.io/neon-terminal-mobile/

> ⚠️ **Yatırım tavsiyesi değildir. Sinyal garanti değildir.** Analiz kendisi hiçbir emir göndermez. Emir yalnızca **İŞLEM** bölümünde, senin anahtarınla ve her seferinde onay penceresinde **ONAYLA**'ya dokunduğunda gider. Vadeli işlemler kaldıraçlıdır; kayıp teminatı aşabilir.

## Nasıl çalışır

Tamamen statik (HTML/CSS/JS). Sunucu yok, hesap yok; API anahtarı yalnızca İŞLEM bölümünü kullanırsan gerekir. Tüm veriler tarayıcıdan doğrudan herkese açık API'lerden çekilir:

| # | Adım | Veri / yöntem |
|---|------|---------------|
| 1 | Grafik tarayıcı | Binance günlük mumlar: 20 günlük kapanış zirvesi kırılımı, boğa bayrağı, 20g ortalamayı geri alma, aşırı satım (RSI<30), aşırı satımdan sıçrama; RSI14, SMA20 |
| 2 | Haberler | Hacker News (Algolia) başlıkları, coin adıyla filtrelenir; yoksa "haber kaynağı yok" |
| 3 | Giriş zamanlayıcı | Binance 5dk mumlar: UTC gününün ilk 60 dakikası açılış aralığı; BEKLİYOR / TETİKLENDİ / SÜRESİ DOLDU |
| 4 | Çıkış planı | Stop = aralık ortası (%0,5–%5 arası değilse %2), hedef 2R, 8 saat sonra kapat — LONG ve SHORT (ayna) |
| 5 | Zaman makinesi | Coinin son 60 günlük 5dk mumlarından aynı UTC saat dilimiyle 10.000 bootstrap simülasyonu + kuralın geçmiş günlerde tekrarı (Web Worker, sabit tohum) — LONG ve SHORT ayrı ayrı |
| 6 | Pozisyon büyüklüğü | Kesirli miktar; varsayılan $1000 hesap, $10 max zarar, %50 tavan |
| 7 | Risk kontrolü | Stop, max zarar (taze fiyatla), ödül:risk ≥ 1,5, tavan, günlük limit, fiyat konumu |
| 8 | Emir fişi | Yalnızca görüntü — KAĞIT / GÖNDERİLMEDİ |
| 9 | Fiyat alarmları | Mesafe çubukları, Binance WebSocket ile anlık fiyat |
| 10 | Analist | CoinGecko: piyasa değeri, FDV, hacim, arz, ATH uzaklığı |
| 11 | Kongre | Tarayıcıdan erişilebilir kaynak yok (CORS) — yalnızca masaüstü sürümde |

## Veri kaynağı: Binance USDⓈ-M Futures (PERP)

Tüm piyasa verisi (analiz, grafik, sinyal, alarmlar, büyüklük, canlı fiyat, şerit) emirlerin gittiği **vadeli perpetual sözleşmeden** gelir: `fapi.binance.com` (`/fapi/v1/exchangeInfo`, `/klines`, `/ticker/24hr`, `/ticker/price`, `/premiumIndex`) ve `wss://fstream.binance.com/market/stream` (`@aggTrade`, `@kline_1m`, `@ticker`, `@markPrice@1s`). Kahraman alanında son fiyat, **Mark fiyatı, fonlama oranı ve sonraki fonlamaya geri sayım** görünür. Fiyatlar sözleşmenin `tickSize` değerine göre biçimlenir; stop/hedef bu adıma yuvarlanır. `PEPE` yazınca `1000PEPEUSDT` gibi kontratlar otomatik bulunur (1 kontrat = 1000 PEPE).

Futures'a ulaşılamazsa (ör. HTTP 451 bölge kısıtı) ya da coinin perpetual'i yoksa veri spot'tan alınır ve kırmızı **"⚠ SPOT verisi (Futures erişilemedi)"** rozeti gösterilir; iki kaynak hiçbir zaman sessizce karıştırılmaz. Testnet'te işlem yaparken onay penceresi testnet mark fiyatını da gösterir (testnet fiyatı gerçek piyasadan farklı olabilir).

*English:* all market data now comes from Binance USDⓈ-M perpetual futures (the same contract orders go to); spot is used only as a clearly flagged last resort.

## Sinyal (LONG / SHORT / BEKLE)

Her analizden sonra panonun üstünde bir sinyal kartı çıkar: yön, güven yüzdesi ve o yön için giriş / stop / hedef (2R). Puan beş faktörün ağırlıklı toplamıdır (−100…+100): açılış aralığı kırılımı (yukarı/aşağı) %30, trend (EMA20/EMA50 ve gün içi VWAP) %25, momentum (1s/4s değişim, RSI uçları) %20, haber başlığı duyarlılığı %10, zaman makinesi LONG ve SHORT başarı farkı %15. +20 üstü LONG, −20 altı SHORT, arası BEKLE. Bu basit bir kuraldır, **garanti değildir**.

## Canlı veri

Fiyat, 24s değişim, mark/fonlama, grafikteki son mum, alarmlar ve "son güncelleme" saati Binance Futures WebSocket akışıyla her işlemde güncellenir; çizim saniyede ~8 kez yapılır. Önce `fstream.binance.com/market/stream`, olmazsa eski `/stream` yolu denenir (veri gelmezse 7 sn içinde geçer); bağlantı koparsa artan beklemeyle yeniden bağlanır, bu sırada 2 saniyelik REST yoklamasına düşer. Göstergeler: **● CANLI** (WebSocket), **● CANLI (REST 2sn)**.

## İŞLEM bölümü

### Binance USDⓈ-M Vadeli (LONG + SHORT)
- **Testnet** varsayılan olarak AÇIK (test parası). Kapatırsan gerçek hesap kullanılır ve her yerde kırmızı **GERÇEK PARA** yazar.
- Bakiye ve açık pozisyonlar (`/fapi/v2/account`, `/fapi/v2/positionRisk`), kaldıraç seçimi (1x varsayılan, en çok 20x, 3x üstünde uyarı).
- PİYASA emri LONG (BUY) veya SHORT (SELL). Miktar ⚙ ayarlarındaki max zarar ve pozisyon tavanından hesaplanır, Binance'in adım/min miktar/min tutar kurallarına yuvarlanır; elle de girilebilir.
- İsteğe bağlı stop ve hedef: `STOP_MARKET` / `TAKE_PROFIT_MARKET`, `closePosition=true` (Binance'in Algo Order servisi). Pozisyonu kapat ve açık emirleri iptal düğmeleri.
- **Her emirde onay penceresi**: sembol, yön, miktar, tutar, kaldıraç, stop, hedef, mod. ONAYLA'ya dokunmadan hiçbir şey gitmez. Otomatik emir yoktur.
- Okumalar REST ile, emirler Binance WebSocket API (`ws-fapi`) ile imzalanıp gönderilir (testnet'in REST emir uçları tarayıcı CORS kontrolünü geçmiyor). İmza: HMAC-SHA256, WebCrypto ile cihazda; saat `/fapi/v1/time` ile eşitlenir, `recvWindow=5000`.

**Güvenlik:**
1. Binance'te yalnızca **Futures (Vadeli)** izni açık bir API anahtarı oluştur. **Para çekme izni KAPALI** olsun.
2. Telefonun IP'si değiştiği için IP kısıtlaması çoğu zaman uygulanamaz; kısıtsız anahtar daha risklidir, işin bitince sil.
3. Anahtar ve secret **yalnızca bu cihazın localStorage'ında** durur ve sadece Binance'e gider (secret hiç gönderilmez, yalnızca imza üretir). "ANAHTARLARI SİL" tamamen temizler.
4. Önce testnet'te dene: https://testnet.binancefuture.com

### Phantom (Solana, yalnızca spot)
- "PHANTOM'U BAĞLA" (`window.phantom.solana`). Phantom yoksa siteyi Phantom uygulamasının tarayıcısında açan bağlantı gösterilir.
- SOL / USDC (ve bulunursa analiz edilen coinin Solana tokenı) bakiyeleri, halka açık Solana RPC ile.
- Jupiter (`lite-api.jup.ag/swap/v1`) teklifi: alınacak miktar, en az miktar, fiyat etkisi, kayma (varsayılan %0,5). Onay penceresinden sonra işlemi **Phantom'da sen imzalarsın** (`signAndSendTransaction`). Mint adresi elle yapıştırılabilir.
- Phantom ile short ve kaldıraç yoktur.

## English (short)

Static, client-only crypto day-trading terminal. After each analysis it shows a LONG / SHORT / WAIT signal card with confidence and entry/stop/2R target (a heuristic, **not a guarantee**). Prices stream live over Binance WebSocket (REST 2 s fallback). The **İŞLEM** (trade) section can place Binance USDⓈ-M futures market orders (long or short, optional reduce-only stop/take-profit via the Algo Order service) and Jupiter spot swaps signed in Phantom. Testnet is on by default; every order or swap needs a confirmation sheet and a tap on ONAYLA; nothing is ever placed automatically. API keys are stored only in the device's localStorage, are only sent to Binance, and the secret only signs locally. Create a futures-only key with withdrawals disabled.

## Bağlantılar

Binance'e `api.binance.com` üzerinden, olmazsa `data-api.binance.vision` üzerinden bağlanır. Coin Binance'te USDT paritesiyle işlem görmüyorsa hata verir.

⚙ düğmesinden hesap büyüklüğü, işlem başı max zarar ve tutma süresi değiştirilebilir; ayarlar yalnızca bu cihazda (localStorage) saklanır.

## Yerelde çalıştırma

```sh
python3 -m http.server 8000
# http://localhost:8000
```

## Atıf ve lisans

Analiz yöntemi (tarayıcı kuralları, açılış aralığı girişi, çıkış planı, zaman makinesi, bütçe ve risk kuralları), [Jakeschincariol/day-trader-skill](https://github.com/Jakeschincariol/day-trader-skill) (MIT Lisansı, © 2026 Jake Schincariol) projesinden kriptoya (7/24) uyarlanarak JavaScript'e taşınmıştır. Ayrıntılar: [NOTICE.md](NOTICE.md).

Grafikler [TradingView Lightweight Charts™](https://github.com/tradingview/lightweight-charts) (Apache-2.0) ile çizilir; kütüphane `vendor/` klasöründe yerel olarak bulunur. Yazı tipleri: Orbitron, Share Tech Mono, JetBrains Mono (SIL Open Font License).

Bu depo MIT Lisansı ile yayımlanır — bkz. [LICENSE](LICENSE).
