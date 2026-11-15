# AKM-34 — Comparador de cenários hipotéticos

A página `#/comparador` contrasta o estado **congelado e sintético** da segunda noite da ODYSSEY-26 (arquivo `backend/app/seed.py`) com valores alternativos digitados pelo operador. São suportados os cinco indicadores oficiais do MVP: sono (h), frequência cardíaca pontual (bpm), humor ordinal (1–5), CO₂ da cabine (ppm) e temperatura da cabine (°C).

### Premissas e proveniência

- Aurora/A1: sono 5,4 h, FC 74 bpm, humor 3; Orion/A2: sono 5,7 h, FC 71 bpm, humor 3; Vega/A3: sono 5,6 h, FC 76 bpm, humor **ausente**; Lyra/A4: sono 7,9 h, FC **ausente**, humor 4.
- Última cabine sintética: CO₂ 980 ppm, temperatura 22,2 °C. Não é telemetria NASA nem medição de Marte exterior.
- Alternativas são entradas locais, não são gravadas no banco nem dispararam regras. O cálculo é simplesmente `hipótese – referência` com a unidade correspondente.
- Valor não medido/fora do domínio → ausência explícita de comparação. Nenhuma classificação de risco/benefício nem previsão médica.

### Critérios de aceite verificáveis

1. A página identifica ambos os cenários e a origem sintética.
2. Alterar um valor apresenta apenas a diferença aritmética; não gera alertas ou recomendações.
3. A3/mood e A4/FC não são preenchidos com zero ou valores inventados.
4. Entradas inválidas e não finitas não produzem diferenças fictícias.
5. O ambiente hipotético pode ser selecionado (AKM-35), mas o comparador não modifica a missão armazenada.

Referências contextuais NASA: https://www.nasa.gov/hrp/hazards/ e https://www.nasa.gov/hrp/risks/ . Relevância científica não significa validação clínica desses números de demonstração.
