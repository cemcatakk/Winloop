# Winloop — MVP Geliştirme Planı

**Hedef:** İlk çalışan sürüm (MVP) ile günlük 3 mod döngüsünü, girişi, temel anti-abuse’ı ve gelir altyapısını teslim etmek.

**Referanslar:** [PROJECT_MASTER_PLAN.md](./PROJECT_MASTER_PLAN.md) · [DB_SCHEMA.md](./DB_SCHEMA.md)

---

## 1. Güvenlik ve Kötüye Kullanım Önleme

- **Sunucu tarafı doğrulama:** Tüm işlemler (skor, aksiyon, puan, reklam kullanımı) sunucuda yetki, limit ve iş kuralı ile doğrulanır; client’a güvenilmez.
- **API güvenliği:** JWT (veya benzeri) ile kimlik doğrulama; rate limiting, CORS; hassas endpoint’ler ek doğrulama.
- **Dosya servisi:** Merkezi yükleme/sunma; dosyalar GUID ile tanımlanır ve GUID ile serve edilir; tip ve boyut kısıtı sunucuda.

---

## 2. Teknoloji Stack (Kesinleşmiş)

| Katman | Seçim | Not |
|--------|--------|-----|
| **Backend** | Node.js + PostgreSQL | Redis opsiyonel (Faz 2+ cache/queue için). |
| **Mobil** | React Native | Tek codebase iOS + Android. |
| **Reklam** | AdMob | Rewarded ad birimleri; test birimleri geliştirme sırasında kullanılacak. |
| **Auth** | Google OAuth + JWT | Mobilde JWT (veya benzeri) ile oturum; token backend’de doğrulanır. |

---

## 3. Veri Mimarisi — Sunucu Odaklı

**Kural:** Uygulama içinde **statik oyun verisi tutulmaz**. Tüm veriler sunucudan API ile gelir; uygulama sadece sunucu yanıtına güvenir.

- **Sabah:** Günlük soru seti ve soru içerikleri API’den.
- **Dungeon:** Item/relic kataloğu, harita seed’i, kurallar API’den.
- **Boss:** Boss tipleri, sembol kataloğu, event bilgisi, damage feed API/WebSocket’ten.
- **Dil:** i18n metinleri API’den (veya ilk yüklemede toplu çekilip cache’lenebilir).
- **Ayarlar:** Kullanıcı tercihleri (dil, bildirim) backend’de saklanır; uygulama açılışında çekilir.

Bu sayede içerik ve balance değişiklikleri uygulama güncellemesi gerektirmeden yapılabilir.

---

## 4. Mobil: Auth, Cache, Tema

### 4.1 Auth (JWT)
- Giriş: Google OAuth sonrası backend’den **JWT** (access + opsiyonel refresh) alınır.
- İsteklerde `Authorization: Bearer <token>` gönderilir; backend her korumalı endpoint’te token’ı doğrular.
- Token süresi ve yenileme politikası backend ile uyumlu tanımlanır.

### 4.2 i18n ve Kalıcı Cache (Redux-Persist + Hash)
- **Redux-persist** ile i18n (ve benzeri sunucudan gelen referans veriler) **yerelde kalıcı** saklanır; her uygulama açılışında tekrar çekilmez.
- **Hash ile güncelleme:** Sunucu i18n (veya katalog) yanıtında **content hash** (örn. ETag veya özel `contentHash` alanı) döner. Uygulama ilk açılışta veya periyodik kontrolte “hash değişti mi?” sorgular; değiştiyse tam veriyi çeker ve persist store’u günceller. Böylece sadece değişiklik olduğunda veri indirilir.

### 4.3 Medya Cache (expo-image)
- Resim ve medya için **expo-image** (veya React Native için önerilen cache’li image kütüphanesi) kullanılır; disk/memory cache ile tekrarlayan isteklerde ağ kullanımı azalır ve performans artar.

### 4.4 Tasarım Standartları — Tek Kaynak (Tema)
- Uygulamadaki **tüm renkler, tipografi ve spacing** tek bir kaynaktan yönetilir: tek tema dosyası (örn. `theme.js` / `theme.ts`) veya StyleSheet/design tokens. CSS-in-JS veya React Native StyleSheet ile bu dosyaya referans verilir; değişiklik tek yerden yapılır ve standartlara uyum sağlanır.

---

## 5. React Native — Sürüm ve Workflow

### 5.1 Sürüm
- **Hedef:** React Native **en güncel kararlı (stable)** sürümü.
- Resmi sürümler: [reactnative.dev/versions](https://reactnative.dev/versions). Proje açılışında `npx react-native init` veya Expo ile oluşturulduğunda otomatik güncel stable kullanılır.
- **Öneri:** 0.76+ (veya dokümantasyondaki “Active support” altındaki sürüm). Major güncelleme yapmadan önce release notes kontrol edilir.

### 5.2 Expo vs Bare React Native
- **MVP için öneri: Expo (managed workflow).**
  - Hızlı kurulum, Expo Go ile anında test.
  - EAS Build ile iOS/Android build; OTA (expo-updates) ile store onayı olmadan küçük güncellemeler.
  - Gerekirse `npx expo prebuild` ile native klasörler açılabilir (AdMob / Google Sign-In gibi native modüller için).
- **Bare tercih edilecekse:** Tam native kontrol, özel native kod; kurulum ve bakım yükü artar. AdMob ve Google OAuth her iki yolda da kullanılabilir (Expo’da ilgili config plugin’ler mevcut).

**Karar:** MVP’de Expo ile başlanır; native ihtiyaç çıkarsa prebuild veya bare’e geçiş değerlendirilir.

### 5.3 Navigasyon
- **React Navigation** kullanılır.
  - **Stack:** Onboarding, auth, mod ekranları (sabah, dungeon, boss).
  - **Bottom tabs:** Ana ekran (günlük 3 mod), Profil, Ayarlar, (ileride Mağaza).
- Kütüphane: `@react-navigation/native`, `@react-navigation/stack`, `@react-navigation/bottom-tabs`. Native bottom tab (RN 0.79+) opsiyonel; MVP’de JS tab yeterli.
- Bağımlılıklar: `react-native-screens`, `react-native-safe-area-context`.

### 5.4 Hata Yönetimi (Error Handling)
- **Error Boundary:** React Error Boundary ile render hataları yakalanır; çökme yerine “Bir şeyler yanlış gitti” ekranı + yeniden dene.
- **Global JS hataları:** `ErrorUtils.setGlobalHandler()` ile yakalanır; log + isteğe bağlı raporlama (Sentry/Bugsnag).
- **Async/network:** API çağrılarında try/catch; kullanıcıya anlamlı mesaj (sunucudan gelen hata metni veya i18n key). Retry ve offline davranışı Faz 2’de derinleştirilebilir.
- **Production:** Sentry (veya benzeri) ile crash ve hata raporlama; native crash’ler için ilgili SDK entegrasyonu.

### 5.5 Profil ve Ayarlar
- **Profil ekranı:** Google’dan gelen avatar, isim; puan bakiyesi; (opsiyonel) günlük streak. Tab’tan erişilir.
- **Ayarlar ekranı:**
  - **Dil:** TR / EN / Cihaz diliyle otomatik. Değişim backend’e gönderilir; uygulama yeniden başlayınca veya anında tüm metinler güncellenir.
  - Ses, bildirim aç/kapa (ileride push için kullanılacak).
- Veri: `user_settings` ve profil bilgisi API’den; değişiklikler PUT/PATCH ile sunucuya yazılır.

---

## 6. Tasarım ve Ürün Kararları

### 6.1 Onboarding
- **Akış:** Uygulama ilk açılışta 3 mod tanıtımı (sabah → öğle dungeon → akşam boss); kısa metin + görsel/skeç. Sonunda “Google ile giriş” veya “Başla”.

### 6.2 Boss Ekranı — Action Roll + Kart Yapısı
- **4 kutu Action Roll** korunur; aynı ekranda **kart yapısı** da kullanılır.
- **Birleşik kullanım:** Kutular dönerken veya sonuç gösterilirken semboller “kart” görünümünde de sunulabilir; bonus türleri (örn. 3 aynı) **kart seti** olarak gösterilebilir.
- **Bonus:** Bonus sonuçları kart (card) UI ile gösterilir; ileride “bonus kartı açma” animasyonu eklenebilir.
- Veri yapısı sunucudan gelir; hem “slot” hem “kart” aynı `action_roll_symbols` / boss event API’si ile beslenir.

### 6.3 Dil
- **Diller:** TR ve EN ile başlanır.
- **Varsayılan:** Telefon diline göre otomatik (TR/EN eşleşirse o dil; yoksa EN veya TR fallback).
- **Değiştirme:** Ayarlar ekranından manuel seçim; tercih backend’e kaydedilir ve tüm API yanıtları buna göre (veya client’ın `Accept-Language` / `locale` parametresiyle) döner.

---

## 7. Veri ve İçerik (Sunucu Tarafı)

### 7.1 Sabah Oyunu — Wordle Benzeri
- MVP’de **Wordle tarzı** tek kelime tahmin oyunu.
- Sorular (kelime + opsiyonel ipucu) ve günlük set **sunucuda** (`morning_questions`, `morning_question_sets`). Uygulama günün setini ve kelimeyi API’den alır; skor ve tamamlama backend’e gönderilir.

### 7.2 Dungeon — Item Tanımları
- Item/relic listesi **DB’de** (`dungeon_item_catalog`); uygulama kataloğu API’den çeker.
- MVP için önerilen itemler (detay [DB_SCHEMA.md](./DB_SCHEMA.md) içinde):
  - **crit_rune** — Boss’ta crit şansı artar
  - **shield_relic** — Boss’ta tek negatif efekti ignore
  - **chaos_orb** — Boss’ta ekstra 1 aksiyon slot’u
  - **health_stone** — HP bonusu
  - **speed_gem** — Süre veya dodge penceresi bonusu

### 7.3 Boss — Genişletilebilir Veri Yapısı
- **MVP’de 1 boss tipi** yeterli; veri yapısı ileride element, 2x bonus vb. destekleyecek şekilde tasarlanır.
- **boss_type_catalog:** `element`, `bonus_rule` (JSONB, örn. 2x bonus koşulu), `resistance` gibi alanlar ileride doldurulur.
- Semboller ve boss davranış kuralları sunucudan gelir; uygulama sadece API/WebSocket yanıtını yorumlar.

---

## 8. Boss Savaşı — Real-Time Teknolojisi

- **İhtiyaç:** Sunucudan sürekli gelen damage feed, boss HP güncellemesi, (opsiyonel) diğer oyuncuların görsel aksiyonları. İstemciden sunucuya aksiyon (roll, dodge) gönderimi.
- **Öneri: WebSocket.**
  - Tek bağlantıda hem client → server (aksiyon) hem server → client (feed, HP, katılımcı listesi) iletilir.
  - Düşük gecikme, polling’e göre daha verimli (pil ve bant genişliği).
- **Alternatif (MVP basitliği):** Kısa aralıklı polling (örn. 2–3 sn) ile feed ve HP çekilebilir; aksiyonlar REST ile gönderilir. Ölçek ve “canlı” his için WebSocket tercih edilir.
- **Backend:** Node’da `ws` veya `socket.io`; bağlantı kimlik doğrulaması JWT/session ile.

---

## 9. MVP Kapsamı (Güncel)

| Dahil | Hariç (sonraki faz) |
|-------|----------------------|
| Google ile giriş | Apple Sign-In, e-posta/şifre |
| Çoklu dil TR + EN; telefon diline göre otomatik, ayarlardan değişim | Ek diller |
| Sabah: Wordle benzeri (veri sunucudan) | Diğer puzzle türleri |
| Dungeon: tek biome, katalogdaki itemler (sunucudan) | Çoklu biome |
| Boss: 4 kutu Action Roll + kart yapısı (bonus kart); dodge, Last Stand, feed | Card combo derinliği, çoklu boss tipleri |
| Diğer oyuncular: sadece görsel/animasyon (veri sunucudan) | Gerçek zamanlı etkileşim |
| Puan + günlük 1 power (1–2 çeşit) | Tüm power çeşitleri |
| Reklam: revive, heal (AdMob rewarded) | Reroll, double reward |
| IP tabanlı çoklu hesap tespiti + puan penaltısı | Cihaz parmak izi |
| Auto-stop’ta perfect timing yok; manuel’de var | — |
| Profil + Ayarlar ekranları, tab navigasyon | Battle pass |
| Error Boundary + global handler + API hata yönetimi | Sentry vb. (önerilir ama opsiyonel MVP) |
| Tüm oyun/i18n verisi sunucudan | Uygulama içi statik veri |

---

## 10. Faz 0: Hazırlık (1–2 hafta)

### 10.1 Stack ve Hesaplar
- [ ] Node + PostgreSQL projesi; migration aracı (örn. node-pg-migrate, Knex).
- [ ] React Native projesi: **Expo** ile oluşturulur (`npx create-expo-app`); RN stable sürümü kullanılır.
- [ ] AdMob hesabı; test reklam birimleri (rewarded) alınır.
- [ ] Google Cloud Console: OAuth client ID (Android, iOS, web/backend).

### 10.2 Tasarım
- [ ] Onboarding: 3 ekran (3 mod tanıtımı) + giriş CTA.
- [ ] Ana ekran: Günlük 3 mod (sabah / dungeon / boss) + tab bar (Ana, Profil, Ayarlar).
- [ ] Boss ekranı: 4 kutu Action Roll + kart görünümü (bonus için); boss HP, damage feed, “diğer oyuncular” alanı (avatar + animasyon).
- [ ] TR + EN metin listesi (i18n key’ler); sunucu tarafında `i18n_keys` + `i18n_translations` veya JSON endpoint ile teslim.

### 10.3 Veritabanı ve API
- [ ] [DB_SCHEMA.md](./DB_SCHEMA.md) şemasına göre migration’lar yazılır ve çalıştırılır.
- [ ] API taslağı: auth, i18n, günlük set (sabah/dungeon/boss), skor gönderimi, puan, leaderboard; WebSocket endpoint (boss feed/aksiyon).

### 10.4 İçerik
- [ ] Sabah: Wordle için 30+ kelime (sunucuya seed’lenir).
- [ ] Dungeon: `dungeon_item_catalog` ve 1 harita/seed mantığı.
- [ ] Boss: `boss_type_catalog` ve `action_roll_symbols` için 1 boss + semboller.

---

## 11. Faz 1: Çekirdek Altyapı (2–3 hafta)

### 11.1 Auth ve Kullanıcı
- [ ] Google OAuth (Expo: `expo-auth-session` veya `@react-native-google-signin`; backend token doğrulama).
- [ ] `users` ve `user_settings`; ilk girişte kayıt; IP log (`ip_logs`).

### 11.2 Dil ve Ayarlar
- [ ] Dil: Cihaz dili okunur; TR/EN değilse varsayılan (örn. EN). Ayarlardan manuel seçim; backend’e kaydedilir.
- [ ] i18n: Metinler sunucudan API ile (veya ilk açılışta toplu); uygulama key → metin çözümlemesi.

### 11.3 Navigasyon ve Ekranlar
- [ ] React Navigation: stack (auth, onboarding, modlar) + bottom tabs (Ana, Profil, Ayarlar).
- [ ] Profil ekranı: avatar, isim, puan; veri API’den.
- [ ] Ayarlar ekranı: dil, ses, bildirim; değişiklikler API’ye gönderilir.

### 11.4 Hata Yönetimi
- [ ] Root’ta Error Boundary; fallback UI + “Yeniden dene”.
- [ ] `ErrorUtils.setGlobalHandler` ile global hata loglama (ve isteğe bağlı Sentry).
- [ ] API client: try/catch, kullanıcıya anlamlı hata mesajı (sunucu veya i18n).

### 11.5 Günlük Zaman ve Puan
- [ ] Backend: Günlük pencereler (sabah/öğle/akşam) ve reset; timezone kuralı netleştirilir.
- [ ] Puan ve günlük power: backend’de hesaplanır; client sadece gönderir/okur.

---

## 12. Faz 2: Üç Oyun Modu (3–4 hafta)

### 12.1 Sabah (Wordle Benzeri)
- [ ] Günün kelimesi ve (varsa) ipucu API’den; skor ve tamamlama backend’e; power kazanımı kaydedilir.

### 12.2 Dungeon
- [ ] Harita ve item kataloğu API’den; run başlatma/bitirme ve toplanan itemler backend’e.
- [ ] Bitişte “Boss’a katılım hakkı” bayrağı; kalan HP boss’a taşınır.

### 12.3 Boss
- [ ] WebSocket (veya polling) ile bağlanma; aksiyon (roll, dodge) gönderimi, feed ve HP alma.
- [ ] 4 kutu Action Roll + kart gösterimi; manuel stop = perfect timing, auto-stop = normal.
- [ ] Slot Lock power; dodge; Last Stand; diğer oyuncular görsel/animasyon (liste sunucudan).
- [ ] Reklam: heal, revive (günde 1); backend limit kontrolü.

---

## 13. Faz 3: Reklam, Anti-Abuse, Mağaza İskeleti (1–2 hafta)

- [ ] AdMob rewarded ad entegrasyonu; izlendikten sonra backend’e ad_views ve hak (heal/revive) yazılır.
- [ ] Aynı IP’den 2+ hesap tespiti; penaltı (puan düşürme veya cap); `users.is_penalized` ve point_transactions’da kayıt.
- [ ] Puan gösterimi (profil / ana ekran); mağaza “Yakında” veya 1 demo kozmetik.
- [ ] Leaderboard API ve ekranı (günlük/haftalık).

---

## 14. Faz 4: İçerik, Test, Yayına Hazırlık (1–2 hafta)

- [ ] Sabah kelime havuzu ve dungeon/boss balance.
- [ ] E2E: giriş → onboarding → sabah → dungeon → boss (reklam dahil); dil ve çoklu hesap penaltı testi.
- [ ] Gizlilik/kullanım koşulları; hesap silme/veri talebi süreci; yaş sınırı; store listeleme (TR + EN).

---

## 15. Özet Zaman Çizelgesi

| Faz | Süre (tahmini) | Çıktı |
|-----|------------------|-------|
| 0 – Hazırlık | 1–2 hafta | Stack, DB migration, API taslağı, tasarım, RN/Expo projesi |
| 1 – Altyapı | 2–3 hafta | Auth, dil, tab nav, profil, ayarlar, error handling, günlük/puan API |
| 2 – Üç mod | 3–4 hafta | Sabah (Wordle), dungeon, boss (Action Roll + kart, WebSocket) |
| 3 – Reklam + Anti-abuse | 1–2 hafta | AdMob, IP penaltı, leaderboard, mağaza iskeleti |
| 4 – Launch | 1–2 hafta | İçerik, test, store hazırlık |

**Toplam MVP:** yaklaşık **8–13 hafta**.

---

## 16. Karar Özeti (Bu Dokümana Göre)

| Konu | Karar |
|------|--------|
| Backend | Node + PostgreSQL |
| Mobil | React Native |
| Reklam | AdMob |
| Auth | Google OAuth |
| RN sürümü | En güncel stable (0.76+); Expo ile kurulum |
| Workflow | Expo (managed); gerekirse prebuild |
| Navigasyon | React Navigation (stack + bottom-tabs) |
| Profil / Ayarlar | Tab’ta; dil/ses/bildirim ayarları backend’de |
| Error handling | Error Boundary + ErrorUtils + API try/catch |
| Veri | Tüm oyun/i18n verisi sunucudan; uygulama statik veri tutmaz |
| Sabah MVP | Wordle benzeri; sorular sunucudan |
| Dungeon itemler | DB_SCHEMA’daki katalog (crit_rune, shield_relic, chaos_orb, health_stone, speed_gem) |
| Boss veri yapısı | Genişletilebilir (element, bonus_rule, resistance); MVP’de 1 tip |
| Boss ekranı | 4 kutu Action Roll + kart yapısı (bonus kart) |
| Boss real-time | WebSocket önerilir; alternatif kısa aralıklı polling |
| Dil | TR + EN; telefon diline göre otomatik, ayarlardan değişim |
| Auth (mobil) | JWT; backend’de doğrulama |
| i18n / referans veri | Redux-persist ile kalıcı; sunucuda content hash, değişiklik varsa çekilir |
| Medya cache | expo-image (veya benzeri) ile resim cache |
| Tema | Tüm renk/ayar tek kaynak (theme.js veya design tokens) |
| Kötüye kullanım | Tüm işlemler sunucuda doğrulanır; API güvenliği (JWT, rate limit) |
| Dosya servisi | Merkezi upload/serve; GUID ile tanımlama ve sunma |

Bu plan, [PROJECT_MASTER_PLAN.md](./PROJECT_MASTER_PLAN.md) ve [DB_SCHEMA.md](./DB_SCHEMA.md) ile uyumludur.
