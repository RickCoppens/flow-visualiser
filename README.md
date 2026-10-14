# flow-visualiser

Interactieve, lokaal draaiende tool om processen vanuit hun gewenste uitkomst opnieuw te ontwerpen (SOLL). Visualiseer benodigde datapunten, afhankelijkheden en beslislogica, met zichtbare aannames en gaten.

Visie, domeinmodel en technische keuzes: [docs/ANKERPUNT.md](docs/ANKERPUNT.md). Regels voor AI-agents: [AGENTS.md](AGENTS.md).

## Starten op je werkcomputer

Vereist: een recente browser (Edge of Chrome) en **Node.js 22.12 of hoger met npm**. Er is geen eigen executable, installer of backend nodig.

Open PowerShell in deze projectmap:

```powershell
npm install
npm run dev
```

Open zelf **http://localhost:4173**. Laat het terminalvenster open; stop de server met Ctrl+C. Een bezette poort geeft een foutmelding: de app wijkt nooit uit naar een andere poort.

Voor normaal gebruik zonder ontwikkelmodus:

```powershell
npm run build
npm run preview
```

Stop eerst de ontwikkelserver voordat je preview start. Beide gebruiken uitsluitend de lokale interface en hetzelfde adres. Open niet rechtstreeks `dist\index.html` en verander `localhost` niet in `127.0.0.1`: dat is voor browseropslag een andere omgeving.

Eenmalig installeren van npm-pakketten vereist toegang tot het pakketregister. **Tijdens gebruik** laadt de app alleen lokale bestanden en benadert geen externe diensten; er zijn geen telemetrie, accounts of externe lettertypen.

## Je eerste ontwerp

1. Maak een canvas en voeg een deliverable toe. Dit maakt zo nodig ook een proces.
2. Bewerk het catalogusitem van het datapunt: term, definitie en kwaliteitscriteria. Items zijn globaal, dus wijzigingen werken in alle canvassen door.
3. Kies **Input toevoegen** op de gegevenskaart en kies een bestaand of nieuw gegeven. Klik op de pijl of de plus om een transformatie tussen beide gegevens te zetten. Een directe verbinding zonder transformatie blijft bewaard met een signaal.
4. Kies **Forcze-uitvraag/beoordeling**, **API**, **Automatisering** of **Agentic/genAI**. Beschrijf de werking in de bijbehorende eigenschappen. De pijlen wijzen van input via transformatie naar het resultaat; de deliverable blijft bovenaan. Klikken op een pijl bij een bestaande transformatie opent die stap.
5. Gebruik processen als filter, klap takken in en bekijk **Gaten & signalen** voor onzekerheid en ontbrekende beschrijvingen.

De layout is automatisch; knooppunten versleep je niet. Gedeelde elementen blijven uniek. Cyclische relaties worden gestreept getoond. Conflicten zoals meerdere producenten worden gesignaleerd, niet weggegooid of geblokkeerd. Nieuwe datapunten starten als *ontbrekend*, transformaties als *onbeschreven*.

Transformatiekaarten hebben een eigen vorm, typepictogram en accent. De kaart toont het type en **Beschikbaar**, **Nog te bouwen** of **Nog te bepalen**. Beschikbaarheid begint op Nog te bepalen en staat los van ontwerpzekerheid en gaten. Bij Nog te bouwen kun je een optioneel **EPIC-nummer** invullen. Wisselen van beschikbaarheid of type wist geen verborgen beschrijvingen. Het oude logische type staat optioneel onder **Logisch type en ontwerpzekerheid**.

Forcze biedt uitvraag/beoordeling en een instructiebeschrijving. API toont operatie en gekoppelde input-/outputlabels. Automatisering biedt businessrule en voorwaarden. Agentic biedt taak/instructie, kaders en menselijke controle. Alles is ontwerpmetadata: de app voert geen formulieren, API-aanroepen, regels of genAI uit.

Koppel aanvullende bestaande elementen via **Afhankelijkheden** in de eigenschappen. Kies wat het geselecteerde element nodig heeft of waarvoor het nodig is. Je kunt ook een verbinding van het bovenste aansluitpunt van een input naar het onderste aansluitpunt van zijn resultaat slepen. Verwijder een verbinding en koppel opnieuw om deze te wijzigen.

Gebruik uitsluitend labels en beschrijvingen. Voer nooit persoonsgegevens, polisgegevens, medische gegevens of inhoudelijke waarden in. Ook het catalogusveld eigenaar is een functielabel, geen persoonsnaam. De app herkent zulke inhoud niet automatisch.

## Opslag en back-ups

Wijzigingen worden automatisch in **IndexedDB** opgeslagen. Kijk naar de opslagstatus bovenaan voordat je afsluit. Bij een opslagfout blijft je werk in het geopende venster beschikbaar: probeer opnieuw op te slaan of exporteer het canvas voordat je afsluit.

Gebruik de app in **één tabblad tegelijk**. Er is geen synchronisatie tussen tabbladen. Gebruik steeds dezelfde browser, hetzelfde profiel en `http://localhost:4173`. Wissen van browsergegevens, privémodus of een andere origin kan je lokale werk onbereikbaar maken of verwijderen.

**Exporteren** maakt een zelfstandige JSON-save file met schemaversie en snapshot van de gebruikte catalogusitems. Exporteer ieder canvas regelmatig; browseropslag is geen back-up. Ongebruikte catalogusitems zitten niet in een canvasexport.

**Importeren** maakt een nieuw canvas en overschrijft geen bestaande save file. Gelijke catalogusitems worden hergebruikt. Bij een conflicterende term blijven beide definities behouden; het geïmporteerde item krijgt een herkenbare `(import)`-aanduiding. De melding benoemt deze conflicten. Een technisch onleesbaar of niet-ondersteund bestand wijzigt niets.

Undo/redo geldt voor bewerkingen binnen de geopende appsessie, ook voor import, verwijderingen en globale cataloguswijzigingen over canvassen heen. De geschiedenis verdwijnt bij herladen; opgeslagen ontwerpen blijven bestaan. Verwijderen van een element verwijdert alleen dat element en zijn verbindingen, nooit automatisch de onderliggende tak.

## Toetsenbord

| Toets | Actie |
|---|---|
| Tab / Shift+Tab | Navigeren tussen bedienbare onderdelen |
| Enter op een knooppunt | Eigenschappen openen |
| Alt+D | Datapunt toevoegen; bij geselecteerde transformatie als input |
| Alt+T | Typekeuze voor transformatie openen; bij geselecteerd datapunt als producent |
| Ctrl+Z | Laatste appbewerking ongedaan maken |
| Ctrl+Shift+Z / Ctrl+Y | Appbewerking opnieuw uitvoeren |

In tekstvelden behouden toetsen hun normale tekstbewerkingsgedrag. Alternatieven voor sneltoetsen en het trekken van een verbinding zijn altijd via knoppen en keuzelijsten beschikbaar.

## Ontwikkelen en controleren

```powershell
npm test
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

De browsertests starten zelf een server op poort 4173; stop andere lokale servers op die poort eerst. Tests gebruiken uitsluitend labels en beschrijvingen.

`src\domain` bevat model, migratie en graafanalyse, `src\graph` de ELK-layout, `src\storage` de Dexie-opslag, `src\exchange` het bestandsformaat en `src\state` de bewerkingsgeschiedenis. Bestandsformaat en canvas gebruiken `schemaVersion: 2`. Lokale opslag en imports uit v1 migreren automatisch: bestaande transformaties worden Automatisering, met behoud van logisch type, beschrijvingen en relaties; beschikbaarheid wordt Nog te bepalen. `migrateFile` is het expliciete versie-ingangspunt. Een volgende opslagmodelwijziging vereist een nieuwe versie en een concrete migratie plus migratietests.
