# 🌑 Tanzim Al-Qahr — Discord Bot

Bot organizacji przestępczej dla serwera FiveM RP.

---

## ⚙️ Instalacja

### 1. Wymagania
- Node.js v18+ ([nodejs.org](https://nodejs.org))
- Konto [Discord Developer Portal](https://discord.com/developers/applications)

### 2. Klonowanie / pobranie projektu

### 3. Instalacja zależności
```bash
npm install
```

### 4. Konfiguracja
Skopiuj `.env.example` do `.env` i uzupełnij wartości:
```bash
copy .env.example .env
```

Otwórz `.env` i wypełnij:

| Zmienna | Opis |
|---|---|
| `BOT_TOKEN` | Token bota z Discord Developer Portal |
| `CLIENT_ID` | ID aplikacji (zakładka General Information) |
| `GUILD_ID` | ID twojego serwera Discord |
| `LOG_CHANNEL_ID` | ID kanału na logi działań |
| `ANNOUNCEMENT_CHANNEL_ID` | ID kanału ogłoszeń |
| `RECRUITMENT_CHANNEL_ID` | ID kanału z panelem rekrutacji |
| `TICKET_CATEGORY_ID` | ID kategorii gdzie tworzone będą tickety |
| `ADMIN_ROLE_ID` | ID roli Admina |
| `MODERATOR_ROLE_ID` | ID roli Moderatora |
| `MEMBER_ROLE_ID` | ID roli nadawanej po akceptacji rekrutacji |

### 5. Rejestracja komend slash
```bash
npm run deploy
```

### 6. Uruchomienie bota
```bash
npm start
```

---

## 📋 Komendy

### Ogólne
| Komenda | Opis |
|---|---|
| `/profil [@czlonek]` | Profil gracza z punktami i rangą |
| `/ranking [top]` | Ranking organizacji |
| `/help` | Lista komend |

### Mod/Admin — Punkty
| Komenda | Opis |
|---|---|
| `/punkty dodaj @czlonek <ilosc> [powod]` | Dodaj punkty |
| `/punkty odejmij @czlonek <ilosc> [powod]` | Odejmij punkty |
| `/punkty historia @czlonek` | Historia punktów |

### Mod/Admin — Warny
| Komenda | Opis |
|---|---|
| `/warn dodaj @czlonek <powod>` | Ostrzeż członka |
| `/warn lista @czlonek` | Lista ostrzeżeń |
| `/warn usun @czlonek <id>` | Usuń ostrzeżenie (Admin) |

### Mod/Admin — Ogłoszenia
| Komenda | Opis |
|---|---|
| `/ogloszenie <tytul> <tresc> [ping] [kolor]` | Wyślij ogłoszenie na kanał ogłoszeń |

### Rekrutacja
| Komenda | Opis |
|---|---|
| `/rekrutacja panel` | Wyślij panel z przyciskiem rekrutacji |
| `/rekrutacja przyjmij` | Przyjmij kandydata (w tickecie) |
| `/rekrutacja odrzuc [powod]` | Odrzuć kandydata (w tickecie) |
| `/rekrutacja zamknij [powod]` | Zamknij ticket |

---

## 🎫 Jak działa rekrutacja

1. Admin wysyła `/rekrutacja panel` na kanał rekrutacji
2. Kandydat klika przycisk **📋 Złóż podanie**
3. Pojawia się **formularz modal** z pytaniami (nick RP, wiek, doświadczenie itp.)
4. Bot tworzy prywatny kanał ticketa (widoczny dla kandydata + moderatorów)
5. Rekruter klika przycisk **✅ Przyjmij** / **❌ Odrzuć** / **🔒 Zamknij**
6. Kandydat dostaje DM z wynikiem
7. Kanał jest automatycznie usuwany

---

## 🏆 System rang (na podstawie punktów)

| Ranga | Punkty |
|---|---|
| 👤 Nowy rekrut | 0 |
| 🔰 Szeregowy | 50 |
| ⚔️ Wojownik | 150 |
| 🗡️ Egzekutor | 300 |
| 🛡️ Strażnik | 500 |
| 💀 Enforcer | 750 |
| 🔥 Kapitan | 1000 |
| 👑 Underboss | 1500 |
| 🌑 Boss | 2000 |

---

## 📁 Struktura projektu

```
tanzim-bot/
├── index.js              # Główny plik startowy
├── deploy-commands.js    # Rejestracja komend slash
├── .env                  # Konfiguracja (NIE commituj!)
├── data/
│   └── bot.db            # Baza danych SQLite (auto-tworzona)
└── src/
    ├── commands/
    │   ├── admin/        # punkty, warn, ogloszenie
    │   ├── tickets/      # rekrutacja
    │   └── general/      # profil, ranking, help
    ├── database/
    │   └── database.js   # Logika bazy danych
    ├── events/
    │   ├── ready.js
    │   ├── interactionCreate.js
    │   └── messageCreate.js
    └── utils/
        ├── constants.js  # Kolory, emoji
        └── helpers.js    # Funkcje pomocnicze
```

## 🛡️ Uprawnienia bota (wymagane)

- `Send Messages` + `Embed Links` + `Read Message History`
- `Manage Channels` (tworzenie ticketów)
- `Manage Roles` (nadawanie roli po akceptacji)
- `Mention Everyone` (opcjonalnie, dla ogłoszeń z @everyone)
