# Cosmic Run

Cosmic Run utvecklades ursprungligen av mig som gymnasiearbete. Originalversionen programmerades i C# med Unity, och jag ansvarade själv för spelets programmering och kreativa produktion. Grafik/design och musik som ingår här kommer från det ursprungliga arbetet.

Det här repositoryt är en senare webbport av originalet till TypeScript. Syftet är att bevara Cosmic Run och göra spelet enkelt att köra direkt i en modern webbläsare — inte att få det att se ut som ett nytt spel.

## Spela lokalt

```bash
npm install
npm run dev
```

Öppna sedan adressen som Vite visar, normalt `http://127.0.0.1:5173`.

För en statisk production-build:

```bash
npm run build
npm run preview
```

## Kontroller

| Kontroll | Funktion |
| --- | --- |
| `Space` eller vänsterklick | Gå från meny till start, hoppa/flappa eller starta om efter död |
| Första och andra flappen i luften | Ger uppåtkraft |
| Tredje flappen i luften | Ger en nedåtriktad rörelse, i linje med `BirdMovement.cs` |
| `Escape` | Avbryt pågående spel och gå tillbaka till huvudmenyn |
| Språkknappen på startsidan | Växla mellan svenska och engelska |

## Teknik

- TypeScript
- HTML5 Canvas
- Vite för lokal utveckling och statisk production-build
- `localStorage` för högsta poäng (motsvarar Unitys `PlayerPrefs`)
- Originalets PNG-, font- och ljudassets under `public/assets/original`

## Struktur

```text
src/
  assets.ts       förladdning av originalbilder och ljudsökvägar
  game.ts         spelstatus, fysik, collision, poäng och high score
  renderer.ts     Canvas-rendering och originalanimationer
  main.ts         input, ljud och animation frame-loop
public/assets/original/
  kopior av de originalassets som används i webbversionen
```

## Portningens förhållande till originalet

Webbversionen återger den senare Unity-varianten i originalmappen: startmeny, startpaus, konstant sidscroll, hinder med slumpade öppningar, mynt, poäng, död/restart och sparad högsta poäng. Markplattformen längst ner samt enstaka upphöjda markplattformar återställer flap-räknaren. Samma figur-, mynt-, hinder-, UI-, font- och ljudassets används.

Unitys `.unity`-scener är binärserialiserade och kunde inte köras i den här miljön. Därför är exakta pixlar för scenplacering och colliders återskapade i Canvas i stället för extraherade automatiskt.
