# ODYSSEY-26 · Dados simulados da AKM-27

Os perfis e todas as observações abaixo são **simulados** e têm finalidade demonstrativa. O conjunto fica em [`backend/app/seed.py`](../backend/app/seed.py), com versões rastreáveis pelo Git. As métricas e unidades seguem o [protocolo AKM-06](akm-06-measurement-protocol.md) e o [dicionário canônico do Notion](https://app.notion.com/p/4189432b222281509e14c95de7f52a2e).

## Carregar e repetir

No ambiente do projeto, execute a partir de `backend/`.

```sh
python -m app.seed
python -m app.seed
```

Em um banco novo, a primeira execução adiciona **4 perfis e 29 medições**. A segunda adiciona zero. Use `AKM_DB_PATH` para escolher um banco separado. A migração é aplicada antes da carga. A transação consulta a combinação astronauta, tipo, horário de coleta e origem, com suporte a astronauta nulo. Registros existentes, inclusive medições manuais no mesmo horário, são preservados.

O seed padrão mantém a rechecagem fora da carga inicial. Depois de criar um follow-up para CO₂ da cabine, execute `python -m app.seed --with-recheck`. Isso adiciona uma leitura simulada de 850 ppm às 15:00 UTC de 14/11/2026. O cadastro recebe o horário real da execução. Repetir a opção preserva a medição e seu horário de cadastro original. O ID dessa medição pode concluir o follow-up antes da reanálise. O [roteiro HTTP da AKM-29](akm-29-investigation-engine-validation.md#reprodução) apresenta o fluxo em um banco isolado.

## Dicionário da amostra

| Indicador | Unidade | Sujeito | Composição |
| --- | --- | --- | --- |
| `sleep_hours` | `h` | Tripulante | 8 leituras, duas por perfil |
| `heart_rate_bpm` | `bpm` | Tripulante | 7 leituras, com uma lacuna de Lyra |
| `mood_score` | `score_1_to_5` | Tripulante | 7 leituras, com uma lacuna de Vega |
| `co2_ppm` | `ppm` | Cabine | 3 confiáveis, 1 suspeita e uma rechecagem opcional |
| `cabin_temp_c` | `C` | Cabine | 3 leituras |

As duas noites têm registros às 07:00 UTC em 13 e 14/11/2026. O seed inicial usa `recorded_at` simulado cinco minutos após cada coleta e `source=synthetic`. Leituras de cabine usam `astronaut_id=null`. As lacunas correspondem a medições ausentes. O CO₂ de 2.200 ppm às 05:05 UTC de 14/11 tem `quality=suspect` como exemplo de dado com qualidade incerta.

## Casos de verificação

- **Coletivo e normal.** As duas noites de Aurora (A1), Orion (A2) e Vega (A3) atendem ao critério sintético da AKM-04. Lyra (A4) permanece fora do achado.
- **Ambiente.** A sequência confiável de CO₂ é 680 → 950 → 980 ppm. A temperatura varia entre 22,1 e 22,2 °C. A coincidência temporal sustenta uma hipótese de demonstração com incerteza.
- **Lacunas e qualidade.** Vega carece de humor e Lyra de frequência cardíaca no segundo dia. A leitura suspeita de CO₂ fica disponível para testar filtragem de evidências.
- **Histórico NASA indisponível.** `GET /api/nasa/references` apresenta referências científicas do NASA HRP, `historical_data_status=not_imported` e série vazia antes e depois do seed. A importação de telemetria histórica e sua apresentação na interface seguem na AKM-39.

Execute `python -m pytest -q backend` a partir da raiz para verificar as unidades, a proveniência, a sequência de sono, a reexecução concorrente e o vínculo da rechecagem na persistência. O teste ponta a ponta com motor e interface pertence à AKM-30.

## Cenários de investigação da AKM-28

O [arquivo de fixtures](../backend/tests/fixtures/odyssey-26-scenarios.json) reaproveita os perfis e horários da AKM-27. Cada caso descreve o escopo, as alterações na amostra base e o resultado esperado para o motor.

| Caso | Entradas | Resultado esperado |
| --- | --- | --- |
| Coletivo | Quatro perfis com duas noites comparáveis. A1, A2 e A3 abaixo ou iguais a 80% de suas baselines nas duas noites. CO₂ da cabine de 680 → 950 → 980 ppm. | `attention` pela heurística sintética. Mostrar a coincidência temporal com incerteza `unconfirmed` e pedir nova medição de CO₂. A simultaneidade orienta a checagem e deixa a causa em aberto. |
| Individual | Aurora permanece com 5,2 h e 5,4 h. A2, A3 e A4 ficam dentro da referência demonstrativa. CO₂ estável em 680 ppm. | `attention` no escopo individual de A1. Sem padrão de tripulação ou hipótese ambiental sustentada. Próxima medição de sono de A1. |
| Dados insuficientes | A2, A3 e A4 têm apenas uma noite disponível e faltam leituras de CO₂. | `insufficient_data` na investigação coletiva. O desvio individual de A1 continua observável. Solicitar uma segunda noite de sono, usando A2 como exemplo de alvo na fixture. |
| Ambiente incerto | Repetir o padrão coletivo com CO₂ suspeito, fora da janela temporal ou ausente. | Preservar a evidência de sono e indicar falta de suporte para a coincidência ambiental. Coletar ou conferir uma leitura comparável antes de inferir associação. |

Da raiz, execute `python -m pytest -q backend/tests/test_scenarios.py`. Os testes registram os dados pela API em bancos temporários, executam a investigação e conferem os resultados e as limitações. O [relatório da AKM-29](akm-29-investigation-engine-validation.md) inclui as variantes de sensores, a matriz de cobertura e a reprodução do ciclo de follow-up.
