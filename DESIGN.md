# Vormgeving van Flow Visualiser

De werkruimte ondersteunt analyseren op een desktop in een gewone kantooromgeving. De graaf en de inhoud staan centraal; decoratie mag status, relaties of bewerking niet verdringen.

- Grafietkleurige navigatie (`#20282f`), een licht neutraal canvas (`#f5f6f8`) en witte invoerpanelen. Het gedempte groene accent (`#176b5b`) markeert primaire acties en selectie; gewone tekst is donker neutraal, niet blauw.
- De compacte witte kop bevat een lokaal getekend graafsymbool en lijniconen voor herstel, import en export. Systeemtypografie via Segoe UI of de beschikbare systeemletter; geen externe assets of lettertypen.
- Links navigatie en procesfilter, centraal het resultaatgerichte netwerk, rechts eigenschappen, catalogus en gaten. Op smallere schermen verschijnt het detailpaneel onder de graaf.
- De deliverableknop is de primaire actie in de canvaswerkbalk. Secundaire invoerknoppen hebben een lichte omtrek; hulpfuncties zijn terughoudender. Geselecteerde canvassen en actieve procesfilters zijn ook semantisch gemarkeerd voor hulptechnologie.
- Datapunten hebben een wit vlak met afgeronde hoeken. Transformaties zijn afzonderlijke stapkaarten met afwisselend rechte en afgeronde hoeken, eigen lijnpictogram, typebenaming en een zacht getint vlak. Forcze gebruikt blauw (`#315f86`), API groen (`#176b5b`), automatisering oker (`#80561c`) en agentic paars (`#6b4685`). Beide kaartsoorten hebben vaste layoutafmetingen van 248 bij 190 pixels. Proceskleur blijft op gegevenskaarten afgeleid en wordt ondersteund door labels en filters.
- Knooppunten geven het meeste gewicht aan het label. Status staat in een compact getint label met tekst en een icoon naast kleur. De onderliggende gatenteller en inklapknop staan onderaan. Selectie en toetsenbordfocus hebben een zichtbare contour. Cyclische relaties zijn gestreept en benoemd.
- Eigenschappen gebruiken rustige invoervlakken, consistente tussenruimte en een compacte keuzebalk. Definities en hulptekst staan tussen eenvoudige scheidingslijnen, niet in extra geneste kaarten. Graafbediening staat in een horizontale balk onderaan.
- Gegevenskaarten bieden Input toevoegen; directe gegevenspijlen hebben een zichtbare plus. De typekeuze verschijnt in het bestaande detailpaneel, zonder modal. Visuele pijlen wijzen omhoog naar het resultaat. Een transformatiekaart toont zowel beschikbaarheid als ontwerpzekerheid met tekst, niet alleen kleur. Het detailpaneel past veldnamen en groepering aan het type aan.
- Dezelfde invoer- en verwijderpatronen gelden voor catalogus, processen en graafelementen. Fouten zijn expliciet; een incompleet ontwerp is geen mislukte handeling.

Animatie beperkt zich tot korte bedieningsovergangen en graafnavigatie; de app bevat geen marketingpagina of decoratieve illustraties. De eerder verwijderde privacybalk blijft afwezig. Vormgeving wijzigt geen domeingedrag, opslagmodel of bestaande gegevens.
