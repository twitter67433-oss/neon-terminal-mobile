# NEON//TERMINAL — mobil

Telefonda çalışan, neon/"2100" görünümlü kripto analiz ve işlem terminali (v6). Ana sayfa artık **MEME** — otomatik al-sat yapan bir pump.fun meme coin platformu (SIM varsayılan); Binance vadeli analizi **VADELİ** sekmesinde. Bir coin yaz (`btc`, `solana`, `init`, `INITUSDT`, `ETH-USD`), Enter'a bas; 11 adımlık day-trader analizi tarayıcının içinde çalışır ve sonuç panoya dökülür.

**Canlı sayfa:** https://twitter67433-oss.github.io/neon-terminal-mobile/

> ⚠️ **Yatırım tavsiyesi değildir. Sinyal garanti değildir.** Elle her işlem onay penceresinde **ONAYLA**'ya dokunduğunda gider. **OTO AL-SAT varsayılan olarak KAPALI**dır; açarsan bot yalnızca BOT CÜZDANI'ndaki parayla, koyduğun limitler içinde onay sormadan işlem yapar. pump.fun tokenlarının büyük çoğunluğu kısa sürede değerini neredeyse tamamen kaybeder; vadeli işlemler kaldıraçlıdır.

## v6 · MEME platformu (ana sayfa)

Sekmeler: **MEME** (`#meme`) · **GROK** (`#grok`) · **VADELİ** (`#vadeli`, eski Binance analizi/grafik/işlem) · **CÜZDAN** (`#cuzdan`, BOT cüzdanı + günlük).

**Modlar**
- **SIM (varsayılan)** — sanal 1 SOL "yatırım" ile kağıt para. Veri gerçek ve canlıdır (PumpPortal yeni token akışı, Solana RPC curve okumaları, kopya cüzdanların gerçek işlemleri). Dolum gerçekçidir: ayarlanabilir gecikme (600 ms) sonrası **curve'ün o anki durumu** üzerinden sabit-çarpım hesabı, kayma, pump.fun %1,25 + PumpPortal %0,5 ücreti, öncelik ücreti, ağ ücreti ve ilk alımda token hesabı kirası (0,00203928 SOL). "Kuru boru hattı" açıksa SIM her işlemde gerçek trade-local işlemini kurar ve atılık bir anahtarla **yerelde imzalar ama göndermez** → gecikme ölçümleri gerçek olur. SIM bakiyesi SIFIRLA yazılarak sıfırlanır.
- **GERÇEK** — BOT CÜZDANI'ndaki parayla. Geçiş için GERÇEK yazmak, başlatmak için risk sayfası + ONAYLA gerekir. Cüzdan GERÇEK oto açıkken kilitlenemez.
- Oto **sayfa yenilenince KAPALI** başlar. "Açılışta otomatik başlat" ayrı bir kutudur, uyarı gösterir ve BAŞLAT yazmayı ister (GERÇEK'te yine de risk + ONAYLA sorulur).
- Elle işlemler (token detayındaki MEME AL/SAT) her zaman **ONAYLA** ister.

**Ajanlar** — İZLEYİCİ (yeni tokenları filtreler, N sn bekleyip momentumu ölçer) · KOPYACI (takip ettiğin cüzdanların pump.fun alımlarını kopyalar, onlar satınca aynı oranda satar) · YÜRÜTÜCÜ (işlemi kurar, imzalar, gönderir, onaylar) · RİSK (kayıptan sonra yarım boyut, art arda 2 kayıpta 60 dk mola, boyutu yalnızca yeni özsermaye zirvesinde büyütür, işlem başı max, günlük max zarar, kill switch).

**Hız (YÜRÜTÜCÜ)** — blockhash önbelleği ~2 sn'de bir; çözülmüş anahtar bellekte; PumpPortal trade-local + öncelik ücreti; açık pozisyonlar için satış işlemi önceden kurulur; isteğe bağlı Jito ipucu (bundle); birden çok RPC'ye paralel gönderim + özel RPC/WS alanı (Helius vb. önerilir); WebSocket `signatureSubscribe` ile onay (yedek: yoklama). Panelde her işlem için **olay→gönderim** ve **gönderim→onay** süreleri ve "HIZ TESTİ" (hiçbir şey göndermez) gösterilir.

**Kopya işlem (anahtarsız)** — PumpPortal'ın cüzdan/token akışları en az 0,02 SOL yüklü bir API anahtarı istediği için kullanılmaz. Bunun yerine Solana RPC WebSocket `logsSubscribe({mentions:[cüzdan]})` (processed) dinlenir ve pump.fun TradeEvent'i çözülür (mint, SOL, token, al/sat, rezervler). Yalnızca bonding-curve işlemleri kopyalanır (PumpSwap/Raydium değil). "KEŞFET" en aktif cüzdanları RPC örneklemesiyle sıralar (çoğu bottur). api.mainnet-beta.solana.com tarayıcı kökenlerine 403 verdiği için sayfada kullanılmaz; yük için kendi RPC/WS adresini girmen önerilir. Genel publicnode WS'i cüzdan aboneliklerinde bazen hiç bildirim göndermiyor (2026-11-10'da aktif bir botta 0 bildirim görüldü); bu yüzden 12 sn sessiz kalan her cüzdan HTTP ile yoklanır (`getSignaturesForAddress` + `getTransaction`, 2,5 sn'de bir, ~1–3 sn gecikme) ve iki yol imzaya göre birleştirilir.

**Pano** — büyük bakiye + yatırımdan beri %, işaretli özsermaye eğrisi, merkezde animasyonlu küre, "Bu gece" zaman çizelgesi, işlem şeridi, risk merdiveni, takip edilen cüzdan kartları (PnL), gecikme tablosu. Işık hüzmeleri (BUS) KOPYA ve GROK düğümleriyle genişledi.

**GROK** — xAI API (`api.x.ai`, CORS açık) ile sohbet; **kendi anahtarın** yalnızca bu tarayıcıda (localStorage) durur, varsayılan model `grok-4.7`. Grok'a kısa bir durum özeti (mod, bakiye, ayarlar, son işlemler, ajanlar) gider; önerileri kart olarak döner ve **UYGULA**'ya dokunursan ayar değişir. Grok **asla işlem yapmaz**. İsteğe bağlı "Grok onayı": her oto alımdan önce evet/hayır sorulur; zaman aşımında (2,5 sn) kurallara ya da reddetmeye düşer.

## Nasıl çalışır

Tamamen statik (HTML/CSS/JS). Sunucu yok, arka uç yok, hesap yok — her şey telefonun tarayıcısında çalışır; API anahtarı yalnızca işlem yaparsan gerekir. Tüm veriler tarayıcıdan doğrudan herkese açık API'lerden çekilir:

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

Tüm piyasa verisi (analiz, grafik, sinyal, alarmlar, büyüklük, canlı fiyat, şerit) emirlerin gittiği **vadeli perpetual sözleşmeden** gelir: `fapi.binance.com` (`/fapi/v1/exchangeInfo`, `/klines`, `/ticker/24hr`, `/ticker/price`, `/premiumIndex`) ve `wss://fstream.binance.com/market/stream` (`@aggTrade`, `@kline_<tf>`, `@ticker`, `@markPrice@1s`, `@forceOrder`). Kahraman alanında son fiyat, **Mark fiyatı, fonlama oranı ve sonraki fonlamaya geri sayım** görünür. Fiyatlar sözleşmenin `tickSize` değerine göre biçimlenir; stop/hedef bu adıma yuvarlanır. `PEPE` yazınca `1000PEPEUSDT` gibi kontratlar otomatik bulunur (1 kontrat = 1000 PEPE).

Futures'a ulaşılamazsa (ör. HTTP 451 bölge kısıtı) ya da coinin perpetual'i yoksa veri spot'tan alınır ve kırmızı **"⚠ SPOT verisi (Futures erişilemedi)"** rozeti gösterilir; iki kaynak hiçbir zaman sessizce karıştırılmaz. Testnet'te işlem yaparken onay penceresi testnet mark fiyatını da gösterir (testnet fiyatı gerçek piyasadan farklı olabilir).

*English:* all market data now comes from Binance USDⓈ-M perpetual futures (the same contract orders go to); spot is used only as a clearly flagged last resort.

## Sinyal (LONG / SHORT / BEKLE)

Her analizden sonra panonun üstünde bir sinyal kartı çıkar: yön, güven yüzdesi ve o yön için giriş / stop / hedef (2R). Puan beş faktörün ağırlıklı toplamıdır (−100…+100): açılış aralığı kırılımı (yukarı/aşağı) %30, trend (EMA20/EMA50 ve gün içi VWAP) %25, momentum (1s/4s değişim, RSI uçları) %20, haber başlığı duyarlılığı %10, zaman makinesi LONG ve SHORT başarı farkı %15. +20 üstü LONG, −20 altı SHORT, arası BEKLE. Bu basit bir kuraldır, **garanti değildir**.

## Canlı veri

Fiyat, 24s değişim, mark/fonlama, grafikteki son mum, alarmlar ve "son güncelleme" saati Binance Futures WebSocket akışıyla her işlemde güncellenir; çizim saniyede ~8 kez yapılır. Önce `fstream.binance.com/market/stream`, olmazsa eski `/stream` yolu denenir (veri gelmezse 7 sn içinde geçer); bağlantı koparsa artan beklemeyle yeniden bağlanır, bu sırada 2 saniyelik REST yoklamasına düşer. Göstergeler: **● CANLI** (WebSocket), **● CANLI (REST 2sn)**.

## v5 · "2100" arayüz

- **Veri yolu (ışınlar):** üstteki canvas'ta BINANCE, PUMP.FUN, MOTOR, SİNYAL, RİSK, EMİR, PHANTOM ve BOT düğümleri arasında ışık parçacıkları akar. Her parçacık **gerçek bir olaydır**: fiyat tiki, likidasyon, sinyal, emir, yeni pump.fun tokenı, bot işlemi. `requestAnimationFrame` ile çizilir, sekme arka plandayken durur; `prefers-reduced-motion` açıksa animasyon kapanır, yalnızca durum gösterilir.
- **Binance tarzı grafik:** 1dk · 3dk · 5dk · 15dk · 30dk · 1s · 2s · 4s · 6s · 8s · 12s · 1G · 3G · 1H · 1A zaman dilimleri (Futures `klines`, 1000/500 mum) + canlı `@kline_<tf>` WebSocket. Mumlar, hacim histogramı, EMA20/EMA50, VWAP (UTC gün içi), sinyalin giriş/stop/hedef çizgileri, açılış aralığı kutusu ve TETİK işareti; açık/kapalı düğmeleri. Seçim cihazda saklanır.
- **Mark / fonlama / geri sayım** aynen duruyor.

## Ek paneller (v5)

| # | Panel | Kaynak |
|---|-------|--------|
| 12 | Derinlik ısı haritası + likidasyonlar | `/fapi/v1/depth` (500 kademe, 4 sn) zaman×fiyat ısı haritası, en büyük alış/satış duvarları, dengesizlik; `@forceOrder` canlı likidasyon noktaları |
| 13 | Açık pozisyon + long/short | `futures/data/openInterestHist`, `globalLongShortAccountRatio`, `topLongShortPositionRatio`, `takerlongshortRatio` |

Ses + titreşim uyarıları: sinyal, fiyatın giriş/stop/hedefi geçmesi, bot işlemleri (BOT bölümünden kapatılabilir).

## BAĞLANTILAR → BINANCE: TEST API ve GERÇEK API

- İki ayrı anahtar yuvası: **TEST API (Testnet)** ve kırmızı **GERÇEK API**. Her biri ayrı localStorage anahtarında durur; "aktif hesap" düğmesiyle hangisinin kullanılacağı seçilir.
- **Bağlantıyı test et**: imzalı istekle USDT bakiyesini gösterir.
- GERÇEK'i aktif yapmak için ekrana **GERÇEK** yazman gerekir; her yerde kırmızı GERÇEK PARA etiketi çıkar.
- Binance'te yalnızca **Futures (Vadeli) iznini** aç, **para çekme iznini KAPALI** bırak. Anahtar ve secret yalnızca bu cihazda durur; secret hiçbir yere gönderilmez, yalnızca imza üretir. Önce testnet'te dene: https://testnet.binancefuture.com

## İŞLEM bölümü (elle)

- Binance USDⓈ-M: PİYASA LONG/SHORT, isteğe bağlı `STOP_MARKET` / `TAKE_PROFIT_MARKET` (Algo Order), kaldıraç (1x varsayılan), pozisyon kapatma. Emirler `ws-fapi` ile imzalanıp gönderilir (HMAC-SHA256, WebCrypto, cihazda).
- Phantom: Jupiter spot swap, Phantom'da sen imzalarsın.
- **Her elle işlemde ONAYLA penceresi** çıkar; dokunmadan hiçbir şey gitmez.

## PUMP.FUN — yeni coinler (canlı)

- Akış: PumpPortal WebSocket `wss://pumpportal.fun/api/data` → `subscribeNewToken` (anahtarsız, ücretsiz) + `subscribeMigration`. Satırda görsel, ad, sembol, mint, piyasa değeri (SOL + USD, SOL fiyatı Jupiter'den), yaratıcı, yaş, pump.fun / Solscan bağlantıları, **rug riski** puanı.
- Metadata (görsel, X/Telegram/web) IPFS'ten: `gateway.pinata.cloud` → `ipfs.4everland.io` → `pump.mypinata.cloud` (ipfs.io/dweb.link tarayıcıya 429 veriyor). Bazı tokenlar CORS'suz sunuculara metadata koyuyor; onlar "metadata okunamadı" diye işaretlenir.
- Satıra dokununca detay: canlı piyasa değeri, bonding curve doluluk %, mini grafik, **canlı işlemler**. Tam işlem akışı (`subscribeTokenTrade`) PumpPortal'da en az 0,02 SOL yüklü bir API anahtarı ister; anahtar yoksa canlı mcap ve al/sat hareketleri bonding curve hesabından Solana RPC WebSocket (`accountSubscribe`) ile çözülür. İsteğe bağlı anahtar yalnızca cihazda saklanır.
- **Rug riski (0–100, sezgisel)**: geliştirici payı, sosyal hesap yok, görsel yok, seri yaratıcı, kopya isim, mcap düşüşü, ilk 10 sahip payı, mint/dondurma yetkisi, **standart dışı bonding curve** (bazı yeni curve'ler 30 yerine çok farklı sanal SOL ile başlıyor; gerçek fiyat PumpPortal'ın mcap'inden çok farklıdır).
- AL / SAT: PumpPortal **trade-local** (`POST /api/trade-local`, CORS açık) imzasız işlemi döndürür; **PHANTOM** seçiliyse Phantom imzalar, **BOT CÜZDANI** seçiliyse bot cihazda imzalar. Kayma % ve öncelik ücreti ayarlanır. Her elle işlemde ONAYLA penceresi.
- pump.fun'ın kendi API'si (`frontend-api-v3.pump.fun`) Cloudflare korumalı ve tarayıcıya 403 veriyor; kullanılmıyor.

## BOT — cüzdan, OTO AL-SAT, günlük

### BOT CÜZDANI
- Anahtar çifti **tarayıcıda üretilir** (`@solana/web3.js` Keypair). Gizli anahtar **PIN ile şifrelenir** (PBKDF2-SHA256 300.000 tur → AES-256-GCM, WebCrypto) ve localStorage'da yalnızca şifreli durur. Sayfa yenilenince kilitlidir.
- Adres + QR kodu, SOL ve token bakiyeleri. **Phantom'dan yükle** (Phantom'da sen onaylarsın), **Phantom'a geri çek** (tümü, ücret payı bırakılır, onay penceresi), **Gizli anahtarı yedekle** (PIN ister, uyarı gösterir, 60 sn görünür), içe aktarma, silme.
- Bot pump.fun (trade-local) ve Jupiter işlemlerini **cihazda kendisi imzalar**; ücret ödeyicisinin bot adresi olduğu kontrol edilir.
- ⚠️ Bu bir "sıcak cüzdan"dır: yalnızca kaybetmeyi göze aldığın küçük bir miktar yükle. Tarayıcı verisi silinirse ve yedeğin yoksa para kaybolur.

### OTO AL-SAT (varsayılan KAPALI)
- v6: pump.fun otosu artık MEME sekmesindeki motordadır (aşağıdaki limitler onun varsayılanlarıdır; SIM/GERÇEK, ajanlar ve risk kuralları yukarıda).
- Açarken bir kez risk uyarısı (onay kutusu), ardından limit özeti için ONAYLA. Sayfa her açıldığında OTO yine KAPALI başlar.
- **Yalnızca BOT CÜZDANI** kullanır; Phantom'a asla otomatik işlem gönderilmez.
- Varsayılan limitler: işlem başı 0,05 SOL, toplam bütçe 0,5 SOL, günlük max zarar 0,25 SOL, en çok 3 açık pozisyon, kâr al +%50, zarar kes −%25, max tutma 15 dk.
- Giriş filtreleri: geliştiricinin ilk alımı ≥ 0,3 SOL, mcap 27–70 SOL, sosyal hesap şartı, dev payı ≤ %10, rug riski ≤ 45, yaratıcı kara listesi; seri yaratıcı ve standart dışı curve elenir; **N saniye (20) bekleyip** momentum ≥ %8 ise alır.
- Çıkış: TP / SL / max tutma / curve tamamlandı; satış 3 kez denenir.
- **Binance oto**: analiz edilen coinin LONG/SHORT sinyali güven eşiğini (%65) geçerse bütçe kurallarına göre MARKET + STOP_MARKET + TAKE_PROFIT_MARKET. Testnet serbest; **GERÇEK hesapta yalnızca ayrı "Binance GERÇEK'te oto" kutusu (varsayılan kapalı) işaretlenip GERÇEK yazılarak onaylanırsa** çalışır. Günde en çok 3 işlem, 5 dk'da bir yeniden analiz.
- Kırmızı **HEPSİNİ DURDUR** (her zaman ekranın köşesinde): tüm otoları kapatır, isteğe bağlı bot pozisyonlarını satar / Binance oto pozisyonlarını kapatır.
- Oto **yalnızca sayfa ön plandayken** çalışır (tarayıcı sınırı). Ekranın kilitlenmemesi için Wake Lock istenir; sekme arka plana geçerse uyarı verir.
- **GÜNLÜK**: her işlem (elle/oto, pump.fun/Binance) giriş/çıkış, PnL, sebep ve imza ile kaydedilir; **CSV indir**.

## English (short)

Static, client-only crypto terminal for phones (no server, no backend). **v6** makes the home page an automatic pump.fun meme-coin platform: SIM paper mode by default (virtual 1 SOL, live data, curve-math fills with slippage and fees, dry-run pipeline that builds and signs but never sends), REAL mode on the bot wallet behind typed confirmation; Watcher / Copier (keyless copy-trading via Solana logsSubscribe + pump.fun TradeEvent decoding) / Executor (blockhash cache, pre-built sells, priority fee, optional Jito tip, multi-RPC fan-out, WS confirms, measured latency) / Risk agents; an equity dashboard; and a GROK chat (xAI API, your own key stored locally) whose suggestions apply only on tap and which can optionally gate auto buys. Grok never trades. Binance futures lives in the VADELİ tab. v5 added: a "2100" data-bus canvas whose light particles are real events; a Binance-style futures chart with every timeframe 1m…1M, volume, EMA/VWAP and signal lines; a depth/liquidation heatmap, open interest and long/short ratios; separate TEST (testnet) and REAL Binance API key slots with a balance test and a typed confirmation for REAL; a live pump.fun new-token feed (PumpPortal WebSocket, live curve trades via Solana RPC, heuristic rug-risk score) with buy/sell via PumpPortal trade-local signed by Phantom or by the bot wallet; a PIN-encrypted in-browser **bot wallet** (PBKDF2 + AES-GCM); and **auto-trading that is OFF by default**, uses only the bot wallet, has hard limits (0.05 SOL/trade, 0.5 SOL budget, TP +50 %, SL −25 %, max 3 positions, daily loss cap), a kill switch, and runs only while the page is in the foreground. Binance auto on a REAL account needs a separate opt-in. Every manual trade needs a tap on ONAYLA. Not investment advice; meme coins are extremely risky.

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

Grafikler [TradingView Lightweight Charts™](https://github.com/tradingview/lightweight-charts) (Apache-2.0) ile çizilir; QR kodu qrcode-generator (MIT); kütüphaneler `vendor/` klasöründe yerel olarak bulunur. Veri: Binance, PumpPortal, Solana RPC (publicnode / Tatum), IPFS ağ geçitleri, Jupiter, CoinGecko. Yazı tipleri: Orbitron, Share Tech Mono, JetBrains Mono (SIL Open Font License).

Bu depo MIT Lisansı ile yayımlanır — bkz. [LICENSE](LICENSE).
