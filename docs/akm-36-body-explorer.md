# AKM-36 — Corpo humano interativo e acessível

Página `#/corpo`. Um SVG esquemático **original**, sem pretensão anatômica clínica, é apresentado com controles HTML nativos sobrepostos e lista textual equivalente. As áreas possuem `button`, `aria-label`, `aria-pressed`, foco visível e suporte nativo a Tab, Shift+Tab, Enter e Espaço. O contexto muda via AKM-35 sem fabricar novas leituras.

| Área selecionada | Associação fiel aos indicadores P0 | Não inferir |
|---|---|---|
| Cabeça/comportamento | `sleep_hours`, `mood_score` autorrelatado | Atividade cerebral ou diagnóstico psicológico |
| Referência cardiovascular | `heart_rate_bpm` leitura pontual | Doença cardíaca ou efeito causal da gravidade |
| Músculos e ossos | **Nenhum indicador P0** | Massa óssea ou perda muscular medidas |
| Habitat | `co2_ppm`, `cabin_temp_c` **fora do corpo** | Diagnóstico respiratório ou exposição individual |

Os links oficiais da NASA para pesquisas de isolamento, gravidade e ambiente fechado são exibidos em cada área. A interface usa texto além de cor e oferece alternativa à seleção visual no SVG.

**Fontes:** https://www.nasa.gov/hrp/hazards/ ; https://www.nasa.gov/hrp/risks/ ; https://www.nasa.gov/hrp/hazard-isolation-and-confinement/ ; https://www.nasa.gov/hrp/hazard-hostile-closed-environments/ .

**Critério de aceite:** percorrer todos os controles de área por teclado, selecionar por Enter/Espaço e verificar que cabeçalho/indicadores/caveats mudam sem alterar o banco nem construir interpretações médicas.
