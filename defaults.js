// Voorbeeldbrieven. Een beheerder kan ze met één klik laden als er nog niets staat.
const SIGN = "Met vriendelijke groet,\n\n[uw naam]\nHuisartsenpraktijk Aarle-Rixtel\n0492-381253";

const DEFAULT_CATS = [
  { id: "algemeen", name: "Algemeen", order: 1 },
  { id: "poh", name: "POH", order: 2 },
  { id: "uzo", name: "UZO", order: 3 },
  { id: "cgm", name: "CGM", order: 4 }
];

const DEFAULT_LETTERS = [
  { id: "welkom", cat: "algemeen", title: "Welkom in de praktijk", subject: "Welkom bij Huisartsenpraktijk Aarle-Rixtel",
    body: "Beste [naam],\n\nWelkom bij Huisartsenpraktijk Aarle-Rixtel. Uw inschrijving is verwerkt en wij zijn blij u als patiënt te mogen verwelkomen.\n\nVoor afspraken, herhaalmedicatie en vragen kunt u ons bereiken via het patiëntenportaal Uw Zorg Online of telefonisch op 0492-381253. Inloggen op het portaal gaat met uw DigiD.\n\nHeeft u vragen? Dan helpen wij u graag.\n\n" + SIGN },
  { id: "inschrijving-afwijzing", cat: "algemeen", title: "Inschrijving niet mogelijk (woont te ver)", subject: "Uw aanvraag voor inschrijving",
    body: "Beste [naam],\n\nHartelijk dank voor uw aanvraag om u in te schrijven bij Huisartsenpraktijk Aarle-Rixtel.\n\nHelaas kunnen wij u niet inschrijven, omdat u buiten ons praktijkgebied woont. Een huisarts in de buurt is belangrijk voor huisbezoeken, de samenwerking met de wijkverpleging en voor spoedsituaties.\n\nWij adviseren u zich in te schrijven bij een huisartsenpraktijk bij u in de buurt.\n\n" + SIGN },
  { id: "uitslag-ok", cat: "algemeen", title: "Uitslag is in orde", subject: "Uitslag [onderzoek] is in orde",
    body: "Beste [naam],\n\nWij hebben de uitslag van [onderzoek] ontvangen. De uitslag is in orde.\n\nU hoeft verder niets te doen. Heeft u klachten of vragen, neem dan gerust contact met ons op via het portaal of telefonisch op 0492-381253.\n\n" + SIGN },
  { id: "uitslag-bespreken", cat: "algemeen", title: "Uitslag bespreken", subject: "Uitslag [onderzoek]: wilt u contact opnemen?",
    body: "Beste [naam],\n\nDe uitslag van [onderzoek] is binnen. Wij willen deze graag met u bespreken.\n\nWilt u een afspraak maken via het portaal of telefonisch op 0492-381253?\n\n" + SIGN },
  { id: "dossier", cat: "algemeen", title: "Hierbij het dossier", subject: "Uw medisch dossier",
    body: "Beste [naam],\n\nHierbij ontvangt u, zoals gevraagd, uw dossier. In de bijlage vindt u: [omschrijving bijlage].\n\nHet bericht bevat persoonlijke gegevens. Bewaar het daarom zorgvuldig en deel het niet met anderen.\n\nHeeft u vragen over de inhoud? Neem dan contact met ons op.\n\n" + SIGN },
  { id: "dossier-overdracht", cat: "algemeen", title: "Dossier overgedragen", subject: "Overdracht van uw dossier",
    body: "Beste [naam],\n\nUw dossier is op [datum] overgedragen aan [nieuwe praktijk]. Vanaf dat moment bent u daar ingeschreven.\n\nWij wensen u het beste toe.\n\n" + SIGN },
  { id: "portaal-werkt", cat: "uzo", title: "Portaal werkt, u kunt inloggen", subject: "U kunt inloggen op Uw Zorg Online",
    body: "Beste [naam],\n\nHet patiëntenportaal Uw Zorg Online werkt zoals het hoort. U kunt nu inloggen met uw DigiD om afspraken te maken, herhaalmedicatie aan te vragen en berichten naar ons te sturen.\n\nLukt het inloggen niet? Bel ons dan op 0492-381253.\n\n" + SIGN },
  { id: "afspraak", cat: "algemeen", title: "Bevestiging afspraak", subject: "Uw afspraak op [datum]",
    body: "Beste [naam],\n\nHierbij bevestigen wij uw afspraak op [datum] om [tijd] bij [behandelaar].\n\nKunt u niet komen? Laat het ons dan zo snel mogelijk weten via het portaal of telefonisch op 0492-381253, zodat een ander die tijd kan gebruiken.\n\n" + SIGN }
];

module.exports = { DEFAULT_CATS, DEFAULT_LETTERS };
