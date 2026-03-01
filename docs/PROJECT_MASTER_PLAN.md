# Winloop — Günlük 3 Modlu Sosyal Oyun Uygulaması

**Proje Özeti (Master Plan)**  
*ChatGPT sohbetinden derlenmiş, geliştirme ve proposal için tek referans doküman.*

---

## 1. Ürün Tanımı

### Amaç
- Kullanıcıların **günde 3 farklı zamanda** uygulamaya dönmesini sağlayan bir **daily habit** oyunu.
- **Kumar bağımlılığına alternatif**: para yatırma/çekme yok; dopamin ve rekabet hissi, zararsız bir döngüde sunulur.
- **Eşitlik**: Pay-to-win yok; herkes aynı temel haklara sahip.

### Temel Döngü
| Zaman   | Mod              | İçerik                                      |
|--------|-------------------|---------------------------------------------|
| Sabah 08:00 | Puzzle / Quiz   | Kelime, genel kültür, bulmaca               |
| Öğle       | Dungeon         | Roguelike, item/relic, süreye karşı        |
| Akşam      | Boss Savaşı     | Sosyal, global boss; sadece dungeon bitirenler |

### Dil ve Erişim
- **Çoklu dil desteği**: Uygulama başta hedef pazarlara göre (örn. TR, EN) çok dilli olacak; tüm metinler, UI ve bildirimler dil seçimine göre gösterilir.
- **Giriş**: **Google ile giriş** (OAuth) birincil yöntem; e-posta/şifre veya diğer yöntemler yol haritasında sonraki fazlarda eklenebilir.

---

## 2. Sabah Oyunu (Puzzle / Quiz)

### Türler
- **MVP:** Wordle benzeri kelime bulma (tek tür).
- İleride: Genel kültür, mini mantık bulmacası.

### Mekanik
- **Skor**: Hız + doğruluk (streak bonus, yanlış cevap cezası).
- **Ödül**:
  - Puan (soft currency)
  - **1 Power-Up** → ertesi gün kullanılacak; 3 oyundan **sadece birinde** kullanılabilir.

### Power-Up Örnekleri
- Slot kilidi (1 kutu sabitlenir — Boss’ta)
- +%10 hasar / crit boost
- 1 hata affı
- Ekstra süre
- Reroll hakkı (reklamla da verilebilir)

### Edge Case’ler
- Sabah oyunu kaçırılırsa: o gün power kazanılmaz; diğer modlar normal oynanır.
- Yarıda çıkış: skor kaydedilmez.
- Bağlantı koparsa: local cache ile yeniden bağlanma.

---

## 3. Öğle Oyunu (Dungeon — Roguelike)

### Amaç
- En kısa sürede bitirmek, en yüksek skoru almak.
- **Dungeon’ı bitirenler** akşam **Boss Savaşı’na katılım hakkı** kazanır.

### Mekanik
- 1 level’den başlar; süreye karşı oynanır.
- **Node türleri**: Combat, Reward, Risk, Heal.
- Base statlar: HP, Attack, Speed, Crit Chance.

### Item / Relic Sistemi
- **Rarity**: Common, Rare, Epic, Legendary.
- **Örnekler**:
  - **Crit Rune** → Boss’ta crit şansı artar
  - **Shield Relic** → Negatif efektleri azaltır / ignore
  - **Chaos Orb** → Boss’ta ekstra aksiyon slot’u
- Dungeon’da toplanan item/relic’ler **Boss savaşında** etkilerini gösterir (build hissi).

### Build Türleri
- Crit Build, Tank Build, Speed Build, Chaos Build.

### Dungeon Bitiremeyenler
- Boss’a giremez.
- İsteğe bağlı: sadece izleyici modu + küçük katılım ödülü.

---

## 4. Akşam Oyunu — Boss Savaşı (Ana Sistem)

### Giriş Şartı
- O günkü dungeon’ı bitirmiş olmak.

### Genel Yapı
- **Global tek boss**; herkes aynı boss’a saldırır.
- **Gerçek realtime değil**: Hamleler canlı gösterilmez; sadece **hasar feed’i**, katkı listesi ve leaderboard güncellenir.
- **Diğer oyuncular**: Ortamda başka oyuncular **sadece görsel ve animasyon** olarak görünür (avatar, isim, basit saldırı/etki animasyonları). Amaç: yalnızlık hissini azaltmak; mekanik/gameplay etkisi yok, sadece sosyal his.
- Amaç: “Yalnız değilim” ve “online savaş” hissi, teknik yükü düşük tutarak.

---

### 4.1 Action Roll + Kart Yapısı (Slot Değil, Combat Hissi)

**Kritik**: UI ve terminoloji **slot makinesi** çağrıştırmamalı; “Action Roll / Combat Sequence” olarak sunulur.

- **4 aksiyon kutusu** (rune / skill kutusu) ve **kart yapısı** birlikte kullanılır: hem kutular hem sonuçlar kart görünümünde sunulabilir; **bonus** (örn. 3 aynı) kart UI ile gösterilir.
- İçerik: **Attack**, **Crit**, **Heal**, **Bonus**, **Debuff** (negatifler oyuncuya zarar verir).

**Oyuncu etkileşimi:**
- Kutular döner; oyuncu **istediği anda tek tek durdurabilir** (manuel stop) **veya** tümünü **auto-stop**’a bırakabilir.
- **Perfect timing**: Sadece **manuel durdurma** ile geçerlidir; doğru zamanda durdurulan kutu bonus alır. **Auto-stop kullanıldığında perfect timing yok**, sadece normal sonuç uygulanır (skill ödülü manuel oynayana verilir).
- **Slot Lock**: Günde 1 kez verilen power’lardan biri; 1 kutu sabitlenir (kullanıcı seçer hangi oyunda kullanacağını).

**RNG + Skill:**
- Sonuçlar RNG + dungeon item/relic ile ağırlıklandırılır.
- Timing ve lock ile oyuncu “ben etkiliyorum” hissi alır.

---

### 4.2 Card Combo Sistemi (Skill-Based)

- Oyuncuya **rastgele kartlar/aksiyonlar** gelir.
- Oyuncu bunları **doğru sıraya** dizer → **Skill Trigger** tetiklenir.

**Örnek kombolar:**
- CRIT → BONUS → CRIT → “Mega Strike”
- HEAL → BONUS → HEAL → “Regen Burst”
- Gizli kombolar: oyuncu keşfeder (retention).

**Dungeon bağlantısı:**
- “Card Shift Relic” → 1 kartı değiştirir
- “Predictor Relic” → Sıradaki kartı gösterir
- “Chaos Relic” → Ekstra kart

---

### 4.3 3 Aynı / Negatif Efektler

- **3 bonus tutturma** → ek bonus oyun / güçlü efekt.
- **Diğer semboller** (örn. -dmg): 3 aynı olunca o efekt uygulanır; **negatifler** oyuncuya zarar verir.
- **Tek negatif** bile gelse efekti olur (ceza hissi dengeli tutulur; “chasing loss” hissi yaratılmaz).

---

### 4.4 Boss Özellikleri

Her boss farklı meta:
- **Reflect** → Fazla hasar yansır
- **Freeze** → Aksiyon yavaşlar
- **Lifesteal** → Hasarı geri emer
- **Puzzle / Pattern** → Doğru pattern’da bonus

---

### 4.5 Dodge Sistemi

- Boss **belli bir yöne** saldırır (herkese aynı anda).
- Oyuncu **refleks ile kaçar** (swipe/tap).
- **Ne kadar hızlı ve başarılı kaçarsa** → ek puan / hasar bonusu.
- Kaçamazsa → can gider.
- **Perfect dodge** → ekstra ödül; ardışık dodge’lar combo bonusu.

---

### 4.6 Can ve Revive

- Oyuncu **dungeon’dan çıktığı can** ile boss savaşına girer.
- **Reklam izleyerek**: can doldurabilir.
- **Reklam izleyerek**: 1 kere **revive** (günde 1).

---

### 4.7 Last Stand Mode

- **Tetiklenme**: Oyuncu ölümcül hasar alır.
- **Davranış**: Özel ekran, güçlü görsel/efekt (Overdrive hissi).
- Oyuncu **son bir atağını** yapar ve boss savaşından çıkar.
- Yüksek risk / yüksek ödül anı; “adil kayıp” ve dramatik kapanış.

---

### 4.8 Boss HP ve Ödül

- **Boss canı**: Dungeon’ı bitirip boss’a katılmaya hak kazanan **oyuncu sayısına** (ve isteğe bağlı dungeon performansına) göre ölçeklenir.
- **Ödül dağılımı**: Toplam hasar, katkı yüzdesi, katılım; buna göre puan ve reward.

---

## 5. Ekonomi ve Mağaza

### Soft Currency (Puan)
- Kazanım: Üç modda skor ve tamamlama.
- **Uygulama içinde**: Sadece oyun içi harcanır (kozmetik, aksesuar, görünüm).
- **Uygulama içinde** puanın paraya veya dışarıya çevrilmesi **yok**.

### Ödül / Sponsor (Politika Uyumu)
- Büyük veya gerçek değerli ödüller (hediye kartı, cihaz, araç vb.):
  - **Şans / RNG ile dağıtılmaz.**
  - **Başarı / leaderboard / turnuva** temelli kampanyalarla verilir.
- Sponsorlardan fiziksel ve sanal ödüller alınabilir; kullanıcıya **reklam, bildirim, SMS, e-posta** ile **harici web sitesine** yönlendirilip orada koşullara göre “bozdurma” yapılabilir.
- Uygulama içinde “puan → para” veya “garanti çekiliş” **yok**; böylece store ve yasal risk azaltılır.

---

## 6. Monetizasyon

### Reklam (Ana Gelir)
- **Rewarded ads**:
  - Revive (günde 1)
  - Heal
  - Reroll
  - Double reward
- Reklam izlemek = ek hak / puan.

### Premium
- **Reklamları kaldır**: Satın alan kullanıcı, reklamla gelen tüm haklara **otomatik** sahip olur (ekstra ödeme yok).

### Battle Pass
- **Sadece kozmetik**: skin, avatar, tema, profil çerçevesi, animasyon.
- Oyun dengesine etki **yok**; eşitlik korunur.

### Sponsor
- Uygulama içi ürün yerleştirme (tematik, rahatsız etmeyen).
- Etkinlik / “haftanın boss’u” sponsorluğu.
- Ödül havuzu sponsor katkısı (başarı/leaderboard bazlı kampanyalarla).

---

## 7. Sosyal ve Rekabet

- **Leaderboard**: Günlük, haftalık.
- **Boss feed**: “X dealt 12,430 CRIT” tarzı anlık hasar akışı.
- **Topluluk hissi**: Global boss barı, katkı listesi; realtime hamle değil, sonuçlar paylaşılır.

---

## 8. Event ve İçerik

- **Günlük**: 3 mod (sabah / öğle / akşam).
- **Haftalık**: Özel boss veya challenge.
- **Sezonsal**: Battle pass, sezon ödülleri.

---

## 9. Güvenlik ve Kötüye Kullanım Önleme

### Sunucu Tarafı Doğrulama
- **Kural:** Uygulamada yapılan tüm işlemler (skor gönderme, aksiyon, puan harcama, reklam kullanımı) **sunucu tarafından doğrulanır**. Client’a güvenilmez; her istek yetki, limit ve iş kuralı kontrolünden geçer.
- **Örnekler:** Sabah skoru (soru seti ve cevap sunucuda kontrol), dungeon bitişi (seed ve süre tutarlılığı), boss hasarı (RNG ve relic sunucuda hesaplanır), revive/heal limiti (ad_views tablosu ile), puan değişimi (sadece sunucu yazar).

### API Güvenliği
- Kimlik doğrulama: JWT (veya benzeri); token süresi ve yenileme politikası tanımlanır.
- Rate limiting, CORS, gerekirse Helmet; hassas endpoint’ler için ek doğrulama.
- Dosya yükleme: tip ve boyut kısıtı; sunucuda virus/tip kontrolü; GUID ile serve (tahmin edilemez URL).

### Merkezi Dosya Servisi (Backend)
- **Tek bir dosya servisi:** Tüm yükleme ve sunma bu servis üzerinden; her dosya **GUID** ile tanımlanır ve GUID ile sunulur (dosya adı ve yol client’a sızmaz).
- Yükleme: desteklenen MIME türleri ve max boyut tanımlı; dosya fiziksel veya object storage’da GUID ile saklanır; metadata (user_id, mime, size) DB’de tutulabilir.
- Sunma: `GET /files/:guid` ile dosya stream edilir; gerekirse erişim kontrolü (public vs authenticated).

---

## 10. Kısıtlar ve Risk Yönetimi

### “Slot / Kumar” Algısı
- UI: Slot makinesi değil; **Action Roll / Rune / Combat** dili.
- Mekanik: Skill (timing, combo, dodge) belirleyici; şans tek başına ödül üretmez.

### Store ve Yasal
- Uygulama içinde para yatırma / çekme **yok**.
- Gerçek değerli ödüller **skill / leaderboard / turnuva** bazlı; çekiliş/şans oyunu değil.
- Türkiye: Kumar/bahis para ile; bu üründe para yok, eğlence amaçlı model.

### P2W
- Battle pass ve premium **sadece kozmetik / reklam kaldırma**.
- Güç özellikleri günde 1, ertesi gün tek modda; küçük avantaj, dengeyi bozmaz.

### Çoklu Hesap / Abuse (Reklam Geliri Koruması)
- **Sorun**: Aynı kişi birden fazla hesapla girerse reklam geliri kişi başı düşer; adil değildir.
- **Tespit**: Aynı **IP** (ve isteğe bağlı cihaz/parmak izi) üzerinden birden fazla hesap tespit edilir.
- **Uygulama**: Tespit edilen hesaplara **puan penaltısı** uygulanır (örn. kazanılan puanın yüzdesi düşürülür veya günlük cap). Tekrarlayan abuse’da hesap kısıtlaması/uyarı gündeme alınır.
- **Hedef**: Tek cihaz / tek hesap kullanımını teşvik etmek; reklam gelirini korumak.

---

## 11. Eksikler ve Eklenebilecekler (Analiz)

*Aşağıdakiler master plan tamamlandıktan sonra tespit edilen olası eksikler ve eklenebilecek özelliklerdir; MVP / sonraki faz kararı proje sahibine bırakılır.*

### Eksik / Netleştirilmesi Gerekenler
| Konu | Durum | Öneri |
|------|--------|--------|
| **Sabah oyunu içerik kaynağı** | Hangi soru/kategori seti, kim üretecek? | MVP’de sabit bir küçük set (örn. 30–50 soru) veya basit API/CSV; Faz 2’de CMS veya topluluk katkısı. |
| **Dungeon süresi / zorluk** | Ortalama run süresi ve “bitirememe” oranı tanımlı değil. | MVP’de tek zorluk, ~3–5 dk hedef; A/B ile ayarlanır. |
| **Boss savaşı süresi** | Oturum ne kadar sürer, ne zaman biter? | Sabit süre (örn. 15 dk) veya boss HP’ye göre; MVP’de sabit süre tercih edilebilir. |
| **Offline / bağlantı kopması** | Puzzle yarıda kesilirse ne olur? | Master planda “skor kaydedilmez” var; dungeon/boss için reconnect ve kısmi kayıt politikası netleştirilmeli. |
| **Bildirim zamanları** | Sabah 08, öğle, akşam için push zamanları net değil. | MVP’de sabah 07:45, öğle 12:00, akşam 18:00 gibi sabit; kullanıcı tercihi Faz 2. |
| **Hesap silme / veri** | KVKK/GDPR uyumu. | Hesap silme ve veri dışa aktarma MVP’de veya store onayı öncesi zorunlu. |
| **Yaş sınırı** | Reklam ve içerik politikası. | 13+ veya 16+ netleştirilmeli; store ve reklam ağı ile uyum. |

### Eklenebilecek Özellikler (Öncelik Opsiyonel)
| Özellik | Fayda | Faz |
|---------|--------|-----|
| **Apple Sign-In** | App Store gerekliliği; Google ile birlikte sunulabilir. | MVP (store için) veya Faz 2 |
| **Misafir oyna → sonra bağla** | Dönüşüm artışı; misafir verisi Google hesabına taşınır. | Faz 2 |
| **Arkadaş listesi / davet** | Sosyal bağ, organik büyüme. | Faz 2–3 |
| **Günlük streak ödülü** | X gün üst üste giriş = bonus puan; retention. | Faz 2 |
| **Tutorial / ilk gün deneyimi** | İlk gün 3 modu tanıtan kısa akış. | MVP (basit) |
| **Ses / titreşim ayarları** | Erişilebilirlik ve kullanıcı tercihi. | MVP (temel) |
| **Dark mode** | Göz yorgunluğu, tercih. | MVP veya Faz 2 |
| **“Recovery mode” (kumar bırakma)** | Marka farkı, duyarlılık; limit + ekstra ödül. | Faz 3 |

### Teknik / Operasyonel
| Konu | Öneri |
|------|--------|
| **Backend dil / stack** | Önceki sohbette Node (Fastify/Nest) + PostgreSQL + Redis; MVP için uygun. |
| **CDN / asset** | Görsel ve animasyonlar için; boss ekranı “diğer oyuncular” görselleri MVP’de hafif tutulabilir. |
| **Analytics** | MVP’de event’ler: giriş, mod tamamlama, reklam izleme, boss katılım; retention ve funnel. |
| **Hata / crash raporlama** | Sentry veya eşdeğeri; MVP’de erken tespit. |

---

## 12. Yol Haritası (Özet)

| Faz | İçerik |
|-----|--------|
| **1 — MVP** | Sabah oyunu (tek kategori), basit dungeon, basit boss (damage feed + leaderboard), puan + günlük power, reklam (revive/heal). |
| **2 — Derinleşme** | Boss çeşitleri, card combo / skill trigger çeşitliliği, dungeon relic setleri, double reward / reroll reklamları, battle pass (kozmetik), haftalık etkinlikler. |
| **3 — Büyüme** | Sezonlar, topluluk etkinlikleri, sponsor kampanyaları, çoklu dil, anti-abuse / adalet iyileştirmeleri. |

---

## 13. İsim Alternatifleri

Hedef: Basit, akılda kalıcı, “kazanç + oyun” hissini hafifçe veren; Türkçe ve İngilizce.

### Öne çıkanlar (sohbetten)
- **Zewin** — Modern, markalaşabilir.
- **Winzo** — Akıcı, global.
- **Wynix** — Premium his; “Win” yerine “Wyn” ile farklı yazım.
- **Winix** — Tech + sade.
- **Wingo** — En basit.
- **Kazano** — Türkiye ağırlıklı.

*Winzy kullanıcı tarafından “alınmış” olarak belirtildi; yukarıdakiler alternatif olarak not edildi.*

---

## 14. Başarı Ölçütleri (KPI)

- Günlük aktif kullanıcı (DAU)
- Retention (D1, D7, D30)
- Gün içi geri dönüş: sabah → öğle → akşam zinciri tamamlama
- Boss katılım oranı
- Reklam tamamlama (rewarded ad)
- Premium dönüşüm
- Oturum süresi ve günlük oturum sayısı

---

## 15. Veri Kaynağı (Mimari İlke)

**Tüm oyun verileri sunucudan gelir.** Uygulama içinde soru listesi, item kataloğu, boss tanımları veya dil metinleri statik tutulmaz; API (ve gerektiğinde WebSocket) ile sunucudan alınır. İçerik ve denge değişiklikleri uygulama güncellemesi olmadan yapılabilir. Detay: [DB_SCHEMA.md](./DB_SCHEMA.md) ve [MVP_DEVELOPMENT_PLAN.md](./MVP_DEVELOPMENT_PLAN.md).

---

## 16. Doküman Notu

Bu dosya, paylaşılan ChatGPT sohbetindeki tüm kararlar, mekanikler, ekonomi, risk ve isim önerileri tek yerde toplanarak **proje özeti** ve **geliştirme / proposal referansı** olarak kullanılmak üzere hazırlanmıştır. Teknik PRD, ekran akışları, DB şeması ve API tasarımı bu master plan’a referans verilerek ayrı dokümanlarda genişletilebilir.
