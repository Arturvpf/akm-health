# AKM-35 — Ambientes de missão e contexto científico

Página: `#/ambientes`. Quatro ambientes **hipotéticos** são selecionados via controle nativo acessível. A seleção, persistida localmente no navegador, atualiza textos e explicações também no Atlas corporal e no Comparador.

| Ambiente | Gravidade de referência | Contexto |
|---|---|---|
| Superfície marciana | 3,7 m/s² ≈ 0,38g | Gravidade parcial, distância, habitat fechado |
| Superfície lunar | 1,6 m/s² ≈ 0,16g | Gravidade parcial, ambiente controlado |
| Análogo terrestre | 9,8 m/s² = 1g | Isolamento simulado, não reproduz exposição espacial |
| ISS / órbita | Microgravidade, sem número calculado no MVP | Ambiente fechado, adaptação orbital, isolamento |

Fonte numérica de Marte/Lua/Terra: https://nssdc.gsfc.nasa.gov/planetary/factsheet/ . Taxonomia dos cinco perigos NASA: https://www.nasa.gov/hrp/hazards/ . A classificação de microgravidade da ISS **não implica gravidade física local literalmente nula**.

## Limite arquitetural

Esta é uma **visão contrafactual local**; a missão persistida no backend continua `ODYSSEY-26`, `destination=mars_surface`, com seus indicadores e observações sintéticas. A seleção não reclassifica leituras, não ajusta limiares médicos, não muda `GET /api/dashboard` e não mistura telemetria de ambientes distintos. Dados externos NASA permanecem em `GET /api/nasa/references` com proveniência separada.

## Verificação

- Selecione Lua → gravidade e explicação lunar aparecem.
- Selecione ISS → explicação de microgravidade sem valor fictício em g.
- Volte a Marte → contexto marciano reaparece e o backend e banco permanecem inalterados.
- A seleção é preservada após recarregar, se o navegador permitir armazenamento.
