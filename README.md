# pixel-weather

En mod till Claude som gör bakgrunden till en animerad pixelscen av vädret där du är, och färgar appen efter vädret. Klart, halvklart, mulet, dimma, regn, snö och åska, var och en i en dag- och en nattversion: sol eller måne med stjärnor, drivande moln, fallande regn och snö, dimband, en och annan blixt och en stuga med tänt fönster på natten. Vädret hämtas från [Open-Meteo](https://open-meteo.com/) var 15:e minut och syns i statusraden, till exempel `Stockholm 4°, regn`.

Scenen och färgerna syns i Claudes desktop- och mobilapp. Terminalen ritar inga teman, men statusraden och `/ort` fungerar där också.

## Installera

I en Claude Code-session i terminalen:

```
/plugin install pixel-weather --marketplace Maximeistern/pixel-weather
```

Svara `y` på frågan om att lägga till marketplace och välj sedan scope.

Från ett skal:

```
claude plugin install pixel-weather --marketplace Maximeistern/pixel-weather
```

I desktopappen, där `/plugin` inte körs: klicka på + bredvid promptrutan, välj Plugins, Add marketplace med `Maximeistern/pixel-weather` och sedan Add plugin.

## Använda

- **Byt ort:** `/ort Malmö`. Finns namnet på flera ställen: `/ort Lund, Skåne` (det efter kommat kan vara län, region, land eller landskod). Bara `/ort` visar vilken ort som används. Valet sparas i modens inställning `City`, som är Stockholm från början.
- **Regnljud:** vid regn och åska har temat ett mjukt regnljud, och åskan har dessutom ett avlägset muller. Det spelas bara när du har slagit på högtalaren i sessionens titelrad.
- **Ljust och mörkt läge** följer solen där du är, i appar som stödjer det.

## Data och integritet

Det enda som lämnar datorn är ortnamnet du anger och ortens koordinater, som skickas till Open-Meteo. Modens anrop har ingen API-nyckel, inget konto och ingen IP-baserad positionering. Väderdata från [Open-Meteo.com](https://open-meteo.com/) under CC BY 4.0.

## Utveckla

`claude plugin test .` kör testerna och `claude plugin validate .` kontrollerar moden som motorn läser den. `hooks/make-colors.js` och `hooks/make-colors.d.ts` är kopierade oförändrade från Claude Codes verktyg för mods och ska inte redigeras.

## Licens

MIT, se [LICENSE](LICENSE).
