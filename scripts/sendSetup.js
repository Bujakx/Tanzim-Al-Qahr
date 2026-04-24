/**
 * Jednorazowy skrypt — wysyła sformatowane wiadomości na wskazane kanały.
 * Uruchom: npm run setup-channels
 */

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const C = {
  GOLD:      0xc9a84c,
  RED:       0x8b0000,
  DARK_BLUE: 0x1a3a5c,
  CRIMSON:   0x722f37,
  GREY:      0x2b2d31,
};

const MESSAGES = [

  // ────────────────────────────────────────
  // 1. Zasady przed rekrutacją
  // ────────────────────────────────────────
  {
    channelId: '1496628652845039868',
    embeds: [
      new EmbedBuilder()
        .setColor(C.DARK_BLUE)
        .setTitle('📋  ZASADY PRZED REKRUTACJĄ')
        .setDescription(
          'Jeśli trafiłeś na ten serwer i chcesz dołączyć do **Tanzim Al-Qahr** — przeczytaj uważnie poniższe zasady.\n\u200b'
        )
        .addFields(
          { name: '🌐  Serwer FiveM', value: 'Dołącz na serwer **MyRP CRIME** i przeczytaj regulamin:\nhttps://discord.gg/uZaAW8BR' },
          { name: '🔄  Etapy rekrutacji', value: 'Rekrutacja odbywa się najpierw **OOC**, a następnie **IC** — zgłoś się na PW do szefa lub zastępcy.' },
          { name: '🤫  Dyskrecja', value: 'Nie zdradzaj nikomu, że starasz się o członkostwo.' },
          { name: '⛔  Kultura osobista', value: 'Brak kultury = natychmiastowe odrzucenie bez możliwości powrotu.' },
        )
        .setFooter({ text: 'Tanzim Al-Qahr' })
        .setTimestamp(),
    ],
  },

  // ────────────────────────────────────────
  // 2. Wzór zgłoszenia urlopu
  // ────────────────────────────────────────
  {
    channelId: '1496628815802269717',
    embeds: [
      new EmbedBuilder()
        .setColor(C.GREY)
        .setTitle('🏖️  WZÓR ZGŁOSZENIA URLOPU')
        .setDescription('Skopiuj poniższy wzór, wypełnij i wyślij na tym kanale.\n\u200b')
        .addFields({
          name: '📝  Formularz',
          value:
            '```\nNick z Discorda:\nStopień / Ranga:\nPowód nieobecności:\nKrótki opis (OOC lub IC):\nData rozpoczęcia urlopu:  DD/MM/RRRR\nData zakończenia urlopu:  DD/MM/RRRR\n```',
        })
        .setFooter({ text: 'Tanzim Al-Qahr' })
        .setTimestamp(),
    ],
  },

  // ────────────────────────────────────────
  // 3. Wzór zgłoszenia nieobecności
  // ────────────────────────────────────────
  {
    channelId: '1496922804476711012',
    embeds: [
      new EmbedBuilder()
        .setColor(C.GREY)
        .setTitle('📅  WZÓR ZGŁOSZENIA NIEOBECNOŚCI')
        .setDescription('Skopiuj poniższy wzór, wypełnij i wyślij na tym kanale.\n\u200b')
        .addFields({
          name: '📝  Formularz',
          value:
            '```\nNick z Discorda:\nStopień / Ranga:\nPowód nieobecności:\nData Nieobecności:\n```',
        })
        .setFooter({ text: 'Tanzim Al-Qahr' })
        .setTimestamp(),
    ],
  },

  // ────────────────────────────────────────
  // 4. Treść przysięgi
  // ────────────────────────────────────────
  {
    channelId: '1496628928398364742',
    embeds: [
      new EmbedBuilder()
        .setColor(C.GOLD)
        .setTitle('⚔️  TREŚĆ PRZYSIĘGI')
        .setDescription(
          '> *„Ja, (imię i nazwisko), stojąc dziś przed obliczem Tanzim Al-Qahr,*\n' +
          '> *dobrowolnie i przy pełnej świadomości,*\n' +
          '> *przysięgam wierność organizacji, jej członkom oraz Al-Qa\'idowi.*\n\n' +
          '> *Przysięgam milczeć tam, gdzie inni mówią.*\n' +
          '> *Przysięgam działać tam, gdzie inni się wahają.*\n' +
          '> *Przysięgam być cieniem, ostrzem i ciszą.*\n\n' +
          '> *Nie zdradzę swoich braci.*\n' +
          '> *Nie ujawnię tajemnic organizacji.*\n' +
          '> *Nie podniosę ręki na swoich.*\n' +
          '> *Nie ugnę się przed wrogiem.*\n\n' +
          '> *Od dziś moje życie należy do Tanzim Al-Qahr.*\n' +
          '> *Moja krew jest jej krwią.*\n' +
          '> *Moje słowo jest jej słowem.*\n' +
          '> *Moja śmierć — jeśli przyjdzie — będzie jej chwałą.*\n\n' +
          '> *Przysięgam to na własne życie.*\n' +
          '> *Przysięgam to na krew i słowo.*\n\n' +
          '> **Tanzim Al-Qahr — aż do końca."**'
        )
        .setFooter({ text: 'Tanzim Al-Qahr' })
        .setTimestamp(),
    ],
  },

  // ────────────────────────────────────────
  // 5. Etapy (3 osobne embedy)
  // ────────────────────────────────────────
  {
    channelId: '1496628945863315568',
    embeds: [
      new EmbedBuilder()
        .setColor(C.CRIMSON)
        .setTitle('🩸  ETAP I — PRÓBA LOJALNOŚCI')
        .setDescription('Kandydat otrzymuje **cel wyznaczony przez przełożonego**.\n\u200b')
        .addFields(
          {
            name: 'Może to być:',
            value:
              '▸ porwanie wskazanej osoby *(za zgodą administracji, w pełni fabularnie)*\n' +
              '▸ zdobycie informacji\n' +
              '▸ przeprowadzenie sabotażu\n' +
              '▸ wykonanie zadania destabilizującego wskazony cel',
          },
          {
            name: '\u200b',
            value: '> Nie liczy się chaos.\n> Liczy się **plan, cisza i skuteczność**.',
          },
        )
        .setFooter({ text: 'Tanzim Al-Qahr' })
        .setTimestamp(),

      new EmbedBuilder()
        .setColor(C.CRIMSON)
        .setTitle('🕯️  ETAP II — SYMBOLICZNA OFIARA')
        .setDescription(
          'Po wykonaniu zadania kandydat staje przed strukturą.\n\n' +
          'Przynosi **dowód wykonania zadania**. Następnie:\n\u200b'
        )
        .addFields(
          {
            name: 'Rytuał',
            value:
              '**1.** Zdejmuje element swojej dotychczasowej tożsamości *(np. dokument, ubranie, maskę)*\n' +
              '**2.** Symbolicznie go niszczy *(spalenie, przecięcie, złamanie)*\n' +
              '**3.** Wypowiada słowa:\n> *„Porzucam to, kim byłem. Wybieram Cień."*',
          },
          {
            name: '\u200b',
            value: '> Ten moment symbolizuje **„śmierć starego życia"**.\n> **Nie ma powrotu.**',
          },
        )
        .setFooter({ text: 'Tanzim Al-Qahr' })
        .setTimestamp(),

      new EmbedBuilder()
        .setColor(C.GOLD)
        .setTitle('⚔️  ETAP III — ZAPRZYSIĘŻENIE')
        .setDescription(
          'Po pozytywnej ocenie zadania przełożony **dopuszcza kandydata do przysięgi**.\n\n' +
          'Dopiero wtedy kandydat wypowiada pełną przysięgę Tanzim Al-Qahr\n' +
          'i zostaje **wpisany do rejestru** jako pełnoprawny członek organizacji.'
        )
        .setFooter({ text: 'Tanzim Al-Qahr' })
        .setTimestamp(),
    ],
  },

  // ────────────────────────────────────────
  // 6. Cele OOC
  // ────────────────────────────────────────
  {
    channelId: '1496628962640793731',
    embeds: [
      new EmbedBuilder()
        .setColor(C.DARK_BLUE)
        .setTitle('✦  CELE OOC — TANZIM AL-QAHR  ✦')
        .setDescription(
          'Nasza organizacja powstała z myślą o **wysokiej jakości rozgrywce RP**.\n\u200b'
        )
        .addFields(
          { name: '🎭  Eventy fabularne',      value: 'Tworzymy immersyjne i nieprzewidywalne **eventy fabularne** dla całego serwera.' },
          { name: '🔍  Materiał dla służb',    value: 'Dajemy służbom *(LSPD, DOJ)* materiał do **śledztw i obserwacji**.' },
          { name: '⚖️  Jakość nad ilością',    value: 'Stawiamy na **jakość RP** ponad ilość akcji agresywnych.' },
          { name: '📖  Sens fabularny',         value: 'Każda akcja ma mieć **powód IC i sens fabularny**.' },
          { name: '🌑  Klimat i immersja',      value: 'Dbamy o klimat — zero **FailRP**, zero **LootRP**.' },
          { name: '📈  Rozwój graczy',          value: 'Rozwijamy się jako gracze i **podnosimy poziom rozgrywki** na serwerze.' },
        )
        .setFooter({ text: 'Tanzim Al-Qahr' })
        .setTimestamp(),
    ],
  },

  // ────────────────────────────────────────
  // 7. Wzór pobierania z magazynu
  // ────────────────────────────────────────
  {
    channelId: '1496629904907960420',
    embeds: [
      new EmbedBuilder()
        .setColor(C.GREY)
        .setTitle('📦  WZÓR POBIERANIA Z MAGAZYNU')
        .setDescription('Skopiuj poniższy wzór, wypełnij i wyślij na tym kanale.\n\u200b')
        .addFields({
          name: '📝  Formularz',
          value:
            '```\nNick IC:\nData pobrania:    DD/MM/RRRR\nGodzina pobrania: HH:MM\nCo zostało pobrane:\nIlość:\n```',
        })
        .setFooter({ text: 'Tanzim Al-Qahr • Magazyn' })
        .setTimestamp(),
    ],
  },

  // ────────────────────────────────────────
  // 8. Kodeks
  // ────────────────────────────────────────
  {
    channelId: '1496630039876468936',
    embeds: [
      new EmbedBuilder()
        .setColor(C.GOLD)
        .setTitle('✦  KODEKS TANZIM AL-QAHR  ✦')
        .addFields(
          { name: 'I.    Lojalność ponad wszystko',             value: 'Zdradzasz organizację — zdradzasz swoje życie.' },
          { name: 'II.   Milczenie to siła',                    value: 'Nie mów nikomu o działalności organizacji poza jej członkami.' },
          { name: 'III.  Rozkazy wykonywane bez dyskusji',      value: 'Możesz wyrazić zdanie, ale dopiero **po wykonaniu rozkazu**.' },
          { name: 'IV.   Nie zostawiasz towarzysza',            value: 'Jeśli brat wpada w tarapaty — robisz wszystko, żeby mu pomóc.' },
          { name: 'V.    Godność organizacji to twoja godność', value: 'Nie kompromiujesz się publicznie.' },
          { name: 'VI.   Wróg organizacji jest twoim wrogiem', value: 'Nie zadajesz się z osobami wrogimi organizacji.' },
          { name: 'VII.  Śmierć przed zdradą',                  value: 'Wolisz konsekwencje niż wydanie brata.' },
        )
        .setFooter({ text: 'Tanzim Al-Qahr' })
        .setTimestamp(),
    ],
  },

  // ────────────────────────────────────────
  // 9. Zasady IC
  // ────────────────────────────────────────
  {
    channelId: '1496630056200573008',
    embeds: [
      new EmbedBuilder()
        .setColor(C.RED)
        .setTitle('✦  ZASADY IC — TANZIM AL-QAHR  ✦')
        .addFields(
          { name: '🎯  Cel akcji',       value: 'Każda akcja musi mieć konkretny powód — nie działamy chaotycznie.' },
          { name: '🧱  Dyscyplina',      value: 'Podczas akcji obowiązuje pełna dyscyplina — jeden człowiek dowodzi, reszta wykonuje.' },
          { name: '🤫  Tajność',         value: 'Zakaz ujawniania przynależności do organizacji osobom postronnym.' },
          { name: '📋  Hierarchia',      value: 'Członkowie nie działają na własną rękę bez wiedzy starszyzny.' },
          { name: '☮️  Jedność',         value: 'Zakaz publicznych konfliktów między członkami organizacji.' },
          { name: '🛡️  Rozsądek',        value: 'Twoje życie jest ważniejsze niż ego — nie giniesz bez powodu.' },
          { name: '🎭  Pseudonimy',      value: 'Podczas akcji zakaz używania prawdziwych imion — tylko pseudonimy.' },
          { name: '💼  Zlecenia',        value: 'Wszystkie zlecenia i sprawy majątkowe przechodzą przez przywódcę lub zastępcę.' },
          { name: '🤝  Sojusze',         value: 'Zakaz sojuszy i rozmów z innymi organizacjami bez zgody przywódcy.' },
          { name: '⚖️  Sąd organizacji', value: 'Członek który złamie kodeks staje przed sądem organizacji.' },
        )
        .setFooter({ text: 'Tanzim Al-Qahr' })
        .setTimestamp(),
    ],
  },

];

// ────────────────────────────────────────
// Logika wysyłania
// ────────────────────────────────────────
client.once('ready', async () => {
  console.log(`✅ Zalogowano jako ${client.user.tag}`);
  console.log(`📡 Wysyłanie wiadomości na ${MESSAGES.length} kanałów...\n`);

  for (const { channelId, embeds } of MESSAGES) {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      console.log(`⚠️  [SKIP] Nie znaleziono kanału ${channelId}`);
      continue;
    }
    await channel.send({ embeds });
    console.log(`✅ [OK]   #${channel.name} (${channelId})`);
    await new Promise(r => setTimeout(r, 600));
  }

  console.log('\n🏁 Gotowe! Wszystkie wiadomości wysłane.');
  client.destroy();
  process.exit(0);
});

client.login(process.env.BOT_TOKEN);
