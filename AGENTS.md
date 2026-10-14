# AGENTS.md

Bron van waarheid: [`docs/ANKERPUNT.md`](docs/ANKERPUNT.md). Lees dat eerst.

Harde regels:

- Alleen de SOLL-situatie. Geen velden voor huidige systemen, werkwijzen of uitvoerders.
- Alleen labels en beschrijvingen. Nooit inhoudelijke waarden of persoonsgegevens, ook niet in testdata.
- Volledig lokaal: geen backend, geen externe aanroepen, geen telemetrie.
- Geen harde validaties die handelingen blokkeren. Signaleer in de UI.
- UI en documentatie in het Nederlands, code en datamodel in het Engels.
- Wijziging van het opslagmodel: verhoog `schemaVersion` en voeg een migratie toe.
- Roadmap-items alleen op uitdrukkelijk verzoek.
