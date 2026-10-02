# Voorstel: protocolbeheer in HAP Berichtsjablonen

Status: voorstel, nog niet gebouwd. Controleer de normen hieronder bij NHG-Praktijkaccreditering (https://www.nhg.org/praktijkaccreditering/) voordat u erop vertrouwt. Dit is gebaseerd op samenvattingen van openbare bronnen, niet op de volledige normdocumenten.

## Wat een audit in de praktijk vraagt
- Praktijkaccreditatie (NPA) is waarderend en werkt in een driejaarscyclus met plan-do-check-act. De auditor wil zien dat u weet welke afspraken gelden, dat medewerkers ze kennen en dat u ze periodiek bekijkt.
- Voor een deel van de onderwerpen vraagt de norm schriftelijke afspraken (denk aan voorbehouden handelingen, infectiepreventie, meldingen, privacy en informatiebeveiliging). Een document-managementsysteem wordt, voor zover bekend, niet geëist. Een geordende map met versies en een overzicht volstaat in de praktijk.
- Voorbehouden handelingen: er moet een opdracht, aantoonbare bekwaamheid, een protocol en toezicht zijn. Het protocol moet dus vindbaar zijn en een datum en eigenaar hebben.
- Privacy en informatiebeveiliging (AVG, NEN 7510/7512/7513) vragen onder meer wie toegang heeft en dat wijzigingen herleidbaar zijn.
- NHG-standaarden en voorbeeldprotocollen gebruiken versienummers: 0.x is concept, 1.0 definitief, 1.1 een kleine wijziging. Dat is een bruikbare afspraak.

## Wat de module moet kunnen
1. Protocollijst met titel, onderwerp (categorie), eigenaar, versie, status (concept, geldig, ingetrokken), datum vastgesteld en datum volgende herziening.
2. Bestand per versie (pdf of Word), bijgevoegd of gelinkt, zoals bij bijlagen nu al kan. Oude versies blijven bewaard en zijn niet te bewerken.
3. Wijzigingslog per protocol: wat is er veranderd, wie, wanneer (wie komt uit de Windows-gebruiker, zoals nu).
4. Herzieningssignaal: protocollen waarvan de herzieningsdatum nadert of voorbij is staan bovenaan, met een teller bij het openen van het programma.
5. Kennisgenomen-registratie: medewerker bevestigt per versie dat hij of zij het gelezen heeft. Dit levert de auditor het bewijs dat het bekend is. Opslaan gebeurt als naam plus datum, geen patiëntgegevens.
6. Overzicht voor de audit: één export (csv of pdf) met alle geldige protocollen, versie, vaststellingsdatum, eigenaar en herzieningsdatum.
7. Koppeling met brieven: een brief of bijlage kan verwijzen naar een protocol (bijvoorbeeld de standaardbrief uitslag-in-orde naar het uitslagenprotocol).

## Waar het in de app past
- Eigen tab "Protocollen" naast de brieven. Zelfde gegevensmap, bestand `protocollen.json` en map `protocollen/<id>/v<versie>/`.
- Schrijven alleen in Beheer (dezelfde rechten en pincode). Kennisgenomen mag elke medewerker, met een apart lichtgewicht schrijfbestand per gebruiker zodat leesrechten volstaan voor de rest.
- Versiebeheer: bij "nieuwe versie" kopieert de app het bestand naar een nieuwe versiemap, verhoogt het versienummer (klein 1.1, groot 2.0), zet de oude op ingetrokken en logt dat.

## Wat het niet is
- Geen vervanging van een kwaliteitssysteem of van de NHG-voorbeeldprotocollen zelf. Het is een register met versies en bewijs.
- Geen plek voor patiëntgegevens.

## Vragen om eerst te beslissen
- Wie is eigenaar per protocol, en hoe vaak herzien (jaarlijks of anders)?
- Is kennisgenomen-registratie per medewerker gewenst, of volstaat teambespreking in de notulen?
- Staan de protocollen nu al ergens (map, Word)? Dan koppelen we die in plaats van over te nemen.
