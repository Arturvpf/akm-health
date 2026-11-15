# AKM-29 · Validação do motor de investigação

A suíte executa as regras experimentais da ODYSSEY-26 pela API FastAPI com SQLite temporário e relógio fixo em 14/11/2026 às 08:00 UTC. Os testes registram as medições por HTTP, conferem o resultado da investigação, relacionam a evidência com a auditoria gravada e verificam a projeção no dashboard. Testes unitários existentes cobrem limites de janela, qualidade, seleção e apresentação. Tarefa AKM-29 (internal Notion page; Portuguese, not part of the submission) · Arquitetura e critérios canônicos (internal Notion page; Portuguese, not part of the submission)

## Resultados na ODYSSEY-26

| Caso | Entradas | Resultado observado |
| --- | --- | --- |
| Tendência coletiva | Duas noites comparáveis, A1–A3 com sono ≤ 80% de suas baselines e CO₂ de cabine em 680 → 950 → 980 ppm | `attention` para a tripulação, A4 `normal`. A resposta registra duas hipóteses `unconfirmed`, coincidência temporal com CO₂ interno e explicações alternativas ainda não verificadas. Uma rechecagem de CO₂ fica pendente. |
| Tendência individual | Duas noites abaixo do limiar para A1, demais perfis dentro da referência sintética e CO₂ estável em 680 ppm | `attention` no escopo de A1, lista de hipóteses vazia e nova medição de sono de A1. Leituras dos demais tripulantes ainda aguardam avaliação no dashboard. |
| Cobertura insuficiente | A1 tem duas noites e A2–A4 têm uma noite cada. Leituras de CO₂ ausentes. | `insufficient_data` para o grupo. A1 mantém `attention`, A2–A4 ficam `insufficient_data` e a verificação pede uma segunda noite de sono de A2. |
| Falha simulada de sensor | As quatro leituras de CO₂ têm `quality:suspect`, incluindo a amostra de 2.200 ppm | A auditoria mantém as leituras suspeitas. A evidência utilizável de CO₂ fica vazia, o achado de sono permanece `attention` e apenas as explicações alternativas continuam como hipótese `unconfirmed`. Sugere-se nova leitura de CO₂. |
| Sensor fora da janela | Horários de coleta de CO₂ recuados em 30 dias | A auditoria mantém o histórico. A análise preserva o achado de sono, registra a limitação ambiental e pede uma leitura de CO₂ comparável. |
| Sensor sem dados | Leituras de CO₂ removidas, com as mesmas oito observações de sono do caso coletivo | `attention` para o grupo, explicações alternativas em aberto e coleta de CO₂ como próxima checagem. |

Os cenários seguem a [fixture da AKM-28](../../backend/tests/fixtures/odyssey-26-scenarios.json). Cada variante de sensor verifica na auditoria quais entradas de CO₂ chegaram ao motor e quais serviram de evidência. [Testes de cenário](../../backend/tests/test_scenarios.py) · [Dados simulados](synthetic-data.md)

## Matriz de verificação

| Critério | Verificação automatizada |
| --- | --- |
| DR-01 · Tendência individual | Duas datas UTC distintas com sono utilizável e baseline positiva. Testes exercitam o limiar inclusivo de 80%, repetição no mesmo período, exclusão de amostras suspeitas e substituição pela leitura utilizável mais recente. [Testes individuais](../../backend/tests/test_individual_rules.py) |
| DR-02 · Tendência coletiva | Dois ou mais perfis com queda na mesma janela sustentam o padrão. Períodos desalinhados, substituição da coorte pela mais recente e o caso sintético A1–A3 são verificados. [Testes coletivos](../../backend/tests/test_collective_rules.py) · [Cenários HTTP](../../backend/tests/test_scenarios.py) |
| T06 · DR-03/04 · Hipóteses, falhas e lacunas | CO₂ com referência e variação comparável gera hipótese temporal, com explicação explícita da incerteza causal e uma hipótese alternativa. Ausência, suspeita ou horários incompatíveis limitam a evidência e preservam achados independentes de sono. Tripulação vazia fica `insufficient_data`, com evidência vazia e sem alvo de coleta. Um perfil conhecido sem sono recebe proposta de coleta. [Cenários HTTP](../../backend/tests/test_scenarios.py) · [Testes de investigação](../../backend/tests/test_investigations.py) |
| DR-05 · Checagem e protocolo | A seleção explica informação, qualidade, disponibilidade e esforço. Um protocolo validado simulado dá preferência à frequência cardíaca de A1 mesmo com esforço alto e CO₂ disponível; a API persiste a checagem e a referência na razão. Testes de seleção cobrem alternativas permitidas, ausência de recursos e encaminhamento humano sem coleta. [Testes de seleção](../../backend/tests/test_next_check.py) · [Testes de investigação](../../backend/tests/test_investigations.py) |
| T07 · Repetição | O `POST /api/investigations/run` repetido devolve a mesma investigação e o mesmo follow-up com `reused:true`. A repetição concorrente grava apenas uma análise e um follow-up. `GET /api/investigations/{id}` recupera o resultado original. [Testes de investigação](../../backend/tests/test_investigations.py) |
| T08 · Nova entrada | O registro de uma medição utilizável marca `has_unanalyzed_measurements:true` e preserva a última análise. A execução explícita muda a fingerprint e limpa o sinal. Duas investigações com o mesmo alvo resultam em um único follow-up pendente. [Testes de investigação](../../backend/tests/test_investigations.py) |
| T09 · DR-06 · Conclusão rejeitada | PATCH sem vínculo, observação suspeita, alvo incompatível ou horário inválido retorna 422. ID de medição inexistente retorna 404. A verificação permanece `pending` com `completed_at` e `measurement_id` nulos. [Testes de investigação](../../backend/tests/test_investigations.py) |
| T10 · DR-06 · Conclusão e reanálise | PATCH válido persiste `completed_at` e `measurement_id`, visíveis por GET. Repetir com o mesmo ID devolve a mesma conclusão, até em concorrência. Usar outra medição retorna 409. A investigação original continua recuperável e a próxima análise é solicitada por POST. [Testes de investigação](../../backend/tests/test_investigations.py) |
| DR-07 · Níveis de alerta | `normal` verde, `attention` amarelo, `insufficient_data` cinza. Texto e ícone acompanham cada cor. Sono sintético de 0 h em dois períodos permanece `attention`. `critical` e vermelho ficam reservados à legenda de protocolo. O dashboard projeta os níveis persistidos quando novos dados aguardam investigação. [Testes de alerta](../../backend/tests/test_alerts.py) · [Testes de investigação](../../backend/tests/test_investigations.py) |

## Reprodução

Instale as dependências indicadas no [README](../../README.md), ative o ambiente Python e execute da raiz.

```sh
python -m pytest -v backend/tests/test_scenarios.py
python -m pytest -q backend/tests/test_investigations.py backend/tests/test_individual_rules.py backend/tests/test_collective_rules.py backend/tests/test_next_check.py backend/tests/test_alerts.py
python scripts/demo_investigation_flow.py
python scripts/check.py
```

O [roteiro HTTP](../../scripts/demo_investigation_flow.py) cria um banco isolado, executa a investigação, repete a entrada, grava a rechecagem e reanalisa. Na execução de validação, o JSON mostrou `initial_result.status: attention`, duas hipóteses, checagem `co2_ppm`, `repeat_reused: true`, `completion.status: completed`, `completion.measurement_id: 30`, `new_data_requires_explicit_run: true` e `updated_investigation_id: 2`.

Em 15/11/2026, com Python 3.13.5 e Node 22.23.5, a suíte focada passou com **182 testes** somando os dois primeiros comandos. O comando padrão passou com **295 testes**, Ruff e checagem de tipos do frontend. Nas duas execuções completas, antes e depois da mudança, o Pytest emitiu um aviso de depreciação do Starlette 1.10.0 sobre `TestClient` com httpx 0.28.1.

## Limitações

- As baselines, a janela de 48 h, a tolerância de alinhamento de 12 h e o limiar de sono de 80% são parâmetros demonstrativos. A análise coletiva usa o par comparável mais recente e aproxima períodos pelas datas UTC. Validação clínica exigiria dados e critérios próprios.
- As variantes de sensor representam qualidade suspeita, falta de amostra e desalinhamento temporal. A investigação trata esses efeitos e preserva a rastreabilidade dos dados. Atribuir a falha à calibração, à transmissão ou ao equipamento exigiria evidência adicional.
- A comparação de CO₂ interno sustenta coincidência temporal. Temperatura permanece contexto descritivo e a lista de hipóteses deixa a causa em aberto. O fixture de protocolo representa uma configuração validada exclusivamente para testar a ordem de preferência.
- A fingerprint mantém o resultado histórico quando apenas o relógio avança. Uma análise nova depende de mudanças nas entradas ou nas configurações consideradas pelo cálculo. O seed tem datas fixas e envelhece fora da janela quando usado com o relógio real.
- Falha de gravação retorna 500 genérico e desfaz a transação. Uma resposta histórica corrompida gera 500 controlado na recuperação. Os testes exercitam ambos com SQLite local. [Persistência e respostas HTTP](../akm-20-investigation-persistence.md)
- A validação visual e de navegação ponta a ponta pertence à AKM-30. Esta suíte verifica a API, a projeção do dashboard e a apresentação dos níveis no backend.