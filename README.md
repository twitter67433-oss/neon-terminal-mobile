# NEON//TERMINAL — mobil

Telefonda çalışan, neon/CRT görünümlü kripto analiz terminali. Bir coin yaz (`btc`, `solana`, `init`, `INITUSDT`, `ETH-USD`), Enter'a bas; 11 adımlık day-trader analizi tarayıcının içinde çalışır ve sonuç panoya dökülür.

**Canlı sayfa:** https://twitter67433-oss.github.io/neon-terminal-mobile/

> ⚠️ **Yatırım tavsiyesi değildir.** Bu sayfa yalnızca analiz yapar. Hiçbir emir göndermez, hiçbir borsaya bağlanmaz, hiçbir cüzdan kodu içermez. Emir fişi her zaman **KAĞIT / GÖNDERİLMEDİ** damgalıdır.

## Nasıl çalışır

Tamamen statik (HTML/CSS/JS). Sunucu yok, hesap yok, API anahtarı yok. Tüm veriler tarayıcıdan doğrudan herkese açık API'lerden çekilir:

| # | Adım | Veri / yöntem |
|---|------|---------------|
| 1 | Grafik tarayıcı | Binance günlük mumlar: 20 günlük kapanış zirvesi kırılımı, boğa bayrağı, 20g ortalamayı geri alma, aşırı satım (RSI<30), aşırı satımdan sıçrama; RSI14, SMA20 |
| 2 | Haberler | Hacker News (Algolia) başlıkları, coin adıyla filtrelenir; yoksa "haber kaynağı yok" |
| 3 | Giriş zamanlayıcı | Binance 5dk mumlar: UTC gününün ilk 60 dakikası açılış aralığı; BEKLİYOR / TETİKLENDİ / SÜRESİ DOLDU |
| 4 | Çıkış planı | Stop = aralık ortası (%0,5–%5 arası değilse %2), hedef 2R, 8 saat sonra kapat |
| 5 | Zaman makinesi | Coinin son 60 günlük 5dk mumlarından aynı UTC saat dilimiyle 10.000 bootstrap simülasyonu + kuralın geçmiş günlerde tekrarı (Web Worker, sabit tohum) |
| 6 | Pozisyon büyüklüğü | Kesirli miktar; varsayılan $1000 hesap, $10 max zarar, %50 tavan |
| 7 | Risk kontrolü | Stop, max zarar (taze fiyatla), ödül:risk ≥ 1,5, tavan, günlük limit, fiyat konumu |
| 8 | Emir fişi | Yalnızca görüntü — KAĞIT / GÖNDERİLMEDİ |
| 9 | Fiyat alarmları | Mesafe çubukları + isteğe bağlı 15 sn canlı fiyat (Binance) |
| 10 | Analist | CoinGecko: piyasa değeri, FDV, hacim, arz, ATH uzaklığı |
| 11 | Kongre | Tarayıcıdan erişilebilir kaynak yok (CORS) — yalnızca masaüstü sürümde |

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
