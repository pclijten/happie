# HAP Berichtsjablonen (Windows-programma)

Standaardberichten en bijlagen voor Huisartsenpraktijk Aarle-Rixtel. Eén programma, geen server, geen internet nodig. Gegevens staan in een gedeelde map (bijvoorbeeld op de M-schijf). Er mogen geen patiëntgegevens in.

## Het programma maken (eenmalig)
**Snelste weg op een Windows-pc:** installeer Node.js (LTS) van nodejs.org, pak deze map uit en dubbelklik `bouw-exe.bat`. Na enkele minuten staat `HAP-Berichtsjablonen.exe` in de map `dist`.

Of via GitHub:
1. Maak op github.com een privé-repository en zet deze map erin.
2. Ga naar Actions, kies "Windows-programma bouwen" en klik Run workflow.
3. Download na een paar minuten `HAP-Berichtsjablonen.exe` bij Artifacts (zip uitpakken).

Zelf bouwen op een Windows-pc met Node 20: `npm install` en dan `npm run dist`. Het resultaat staat in `dist`. Uitproberen zonder bouwen: `npm start`.

## Installeren op de M-schijf
1. Maak `M:\Berichtsjablonen\` en zet `HAP-Berichtsjablonen.exe` erin.
2. Maak daarnaast een map `M:\Berichtsjablonen\Gegevens\` (ook als rechten: zie hieronder). Het programma vindt die map zelf. Anders vraagt het bij de eerste start om een map.
3. Start het programma. De acht voorbeeldbrieven worden aangemaakt.
4. Beheer, Instellingen: zet "Automatisch starten met Windows" aan op elke computer waar dat moet. Of zet een snelkoppeling naar de exe in `shell:startup`.

## Rechten (dit is de echte beveiliging)
- Beheerders: wijzigen op `Gegevens`. Medewerkers: alleen lezen. Wie niet kan schrijven, ziet geen Beheer-knop.
- De optionele pincode in Instellingen voorkomt alleen per ongeluk wijzigen. Het is geen beveiliging tegen iemand met schrijfrechten.

## Bijlagen: bijvoegen of linken
- Bestand bijvoegen: er komt een kopie in `Gegevens\bijlagen`. Verplaatsen van het origineel doet niets.
- Koppelen: een pad (`M:\Formulieren\intake.pdf`) of webadres. Handig als het bestand al ergens beheerd wordt. Verplaatst iemand het, dan toont het programma een waarschuwing.
- Medewerkers kiezen Openen, Opslaan als of Kopieer pad en voegen het bestand in het portaal toe.

## Back-ups en gelijktijdig werken
- Per dag een back-up in `Gegevens\back-ups` (laatste 60 dagen). Terugzetten: kopieer een back-up over `sjablonen.json`.
- Wijzigen gebeurt met een slotbestand en atomisch schrijven. Open schermen verversen zichzelf binnen een paar seconden.
- Bij elke wijziging staat wie het deed (Windows-gebruiker@computer) in het bestand.

## Bekende beperkingen
- Windows kan bij een niet-ondertekend programma een SmartScreen-melding tonen: kies Meer info, Toch uitvoeren. Laat de ICT-leverancier het programma anders toestaan.
- Op een netwerkschijf zonder goede bestandsvergrendeling kunnen twee gelijktijdige opslagen elkaar in zeldzame gevallen vertragen. Het slot wacht maximaal ongeveer 6 seconden.

## Protocollen (nieuw)
- Tabblad Protocollen: register met thema, eigenaar, versie, status, vaststellings- en herzieningsdatum. De protocollen blijven op hun eigen plek (Word-bestanden); het programma wijst ernaar.
- Iedereen werkt op een eigen Windows-account. De beheerder koppelt onder Personen elk account aan een naam en initialen. Wie niet gekoppeld is kan lezen, maar niet registreren.
- "Ik heb versie x gelezen" legt naam, versie en tijd vast. Bij een nieuwe versie moet iedereen opnieuw bevestigen. De beheerder ziet per protocol wie nog moet lezen.
- Bewerken in Word: de beheerder kiest Bewerken in Word. Het programma zet een kopie van de huidige versie in `protocol-archief`, markeert het protocol als in bewerking (niemand anders kan het dan bewerken) en opent het origineel. Daarna: Word sluiten, Klaar met bewerken, kleine of grote wijziging kiezen, toelichting invullen. Versie 1.0 wordt 1.1 (klein) of 2.0 (groot).
- Jaarlijkse herziening: de volgende herzieningsdatum staat standaard 12 maanden na vaststelling. Op het overzicht staan protocollen die binnen 60 dagen of te laat zijn. "Herzien, geen wijziging" zet de datum een jaar vooruit.
- Auditoverzicht: Overzicht, Kopieer auditoverzicht, plakken in Excel.

### Extra rechten voor protocollen
- Beheerders: wijzigen op de hele gegevensmap.
- Medewerkers: lezen op de gegevensmap en op de map met protocollen, plus **wijzigen op de submap `leesbewijzen`**. Iedereen schrijft daar alleen zijn eigen bestand. Zonder dit kan een medewerker niet als gelezen registreren.
- Protocolbestanden zelf: alleen beheerders mogen schrijven.
- Naam en Windows-account zijn geen echte inlog. Het is een leesregistratie die werkt zolang iedereen op een eigen account werkt.
- Word-bestanden die op een andere plek in gebruik zijn kunnen niet worden gelezen als ze open staan bij een collega met schrijfrechten; dat is een Word-eigenschap.
