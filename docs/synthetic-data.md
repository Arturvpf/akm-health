# ODYSSEY-26 · Dados simulados da AKM-27

Os perfis e todas as observações abaixo são **simulados** e têm finalidade demonstrativa. O conjunto fica em [`backend/app/seed.py`](../backend/app/seed.py), com versões rastreáveis pelo Git. As métricas e unidades seguem o [protocolo AKM-06](akm-06-measurement-protocol.md) e o [dicionário canônico do Notion](https://app.notion.com/p/4189432b222281509e14c95de7f52a2e).

## Carregar e repetir

No ambiente do projeto, execute a partir de `backend/`.

```sh
python -m app.seed
python -m app.seed
```

Em um banco novo, a primeira execução adiciona **4 perfis e 29 medições**. A segunda adiciona zero. Use `AKM_DB_PATH` para escolher um banco separado. A migração é aplicada antes da carga. A transação consulta a combinação astronauta, tipo, horário de coleta e origem, com suporte a astronauta nulo. Registros existentes, inclusive medições manuais no mesmo horário, são preservados.

O seed padrão mantém a rechecagem fora da carga inicial. Depois de criar um follow-up para CO₂ da cabine, execute `python -m app.seed --with-recheck`. Isso adiciona uma leitura simulada de 850 ppm às 15:00 UTC de 14/11/2026. O cadastro recebe o horário real da execução. Repetir a opção preserva a medição e seu horário de cadastro original. O roteiro pode usar o ID dessa medição para concluir o follow-up e reanalisar quando essas operações estiverem integradas.

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
