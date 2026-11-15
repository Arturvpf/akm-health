# AKM-26 · Explicação e segurança na investigação

As respostas de `POST /api/investigations/run` e `GET /api/investigations/{id}` incluem `explanation`. A Investigação (AKM-16) pode renderizar esse objeto junto com o achado, as evidências, as hipóteses e a próxima checagem que já recebe. Os textos vêm do resultado e da decisão de checagem do servidor. A biblioteca educativa da AKM-09 passa por revisão de Pesquisa/Segurança antes da publicação em `guidance`, que continua retornando `[]`. [Critérios AKM-08](../akm-08-alert-safety.md) · [Biblioteca AKM-09](../akm-09-guidance-library.md) · Arquitetura (internal Notion page; Portuguese, not part of the submission)

## Campos para a tela de Investigação

| Campo | Apresentação |
| --- | --- |
| `coverage` | Período de observação em UTC e IDs dos perfis que foram avaliados pela regra. No coletivo, são os perfis da janela comparável escolhida pelo motor. A lista vazia significa que o motor teve cobertura insuficiente para classificar o escopo solicitado. O valor `null` indica que o registro salvo carece desses detalhes de auditoria. |
| `limitations` | Limites da simulação e da evidência disponível. Exibir com o rótulo de demonstração e as leituras que sustentam o achado. |
| `uncertainty` | Explicação em texto da lacuna, hipótese em aberto ou alcance da regra. A certeza de cada hipótese vem de `hypotheses[].certainty` e continua `unconfirmed`. Quando o motor compara CO₂ com um achado de sono, a explicação traz o resultado dessa comparação. |
| `references` | Cada referência contém `source_id`, `title`, `url` e `relevance`. Mostrar a relevância junto com o link. A arquitetura define a regra demonstrativa. As fontes NASA explicam o contexto de pesquisa do sono e do ar interno da cabine. [Fundamentação AKM-07](../scientific-sources.md) |
| `check_context` | `status` e `reason` da seleção AKM-23. Para `selected`, usar o tipo, alvo e esforço de `next_check`, com a justificativa apresentada uma vez. Para `unavailable`, `needs_context`, `no_check_needed` ou `protocol_referral`, explicar a situação sem criar uma ação de coleta. `null` indica ausência da decisão auditável no registro. [Contrato AKM-23](akm-23-next-check.md) |
| `human_review` | Em `conditional`, mostrar quando consultar a equipe e quais informações levar. Em `per_protocol`, mostrar a instrução para procurar o responsável sem aguardar coleta. Esse modo exige a decisão `protocol_referral` da AKM-23, que usa a referência de protocolo configurada e declarada validada. Tratar `protocol_reference` como texto. O contato e o envio são manuais. |

Para compatibilidade com servidores anteriores, o tipo TypeScript aceita ausência de `explanation`. A API monta a explicação a partir dos fatos auditados de cada investigação. O formato no SQLite, IDs, fingerprints, achados, evidências, estado e vínculos de verificações seguem o contrato da AKM-20. Quando uma seção antiga falta ou está inconsistente, a explicação usa os fatos disponíveis e sinaliza a lacuna. Recuperar um registro antigo usa somente a leitura do resultado e de sua auditoria. As verificações vinculadas continuam usando o fluxo da [AKM-20](../akm-20-investigation-persistence.md).

## Demonstração local

Com o ambiente do [README](../../README.md) preparado, execute da raiz do repositório.

```sh
python scripts/demo_investigation_flow.py
python -m pytest -q backend/tests/test_investigations.py
```

O script fixa a janela e carrega a ODYSSEY-26 em um banco temporário. Em `initial_result`, observe `attention`, A1 a A4 na cobertura, a hipótese ambiental `unconfirmed`, a referência `NASA-CO2`, `check_context.status=selected` e a nova coleta de CO₂. A explicação indica que coincidência temporal não estabelece causalidade. O script também repete a solicitação, recupera o registro, conclui a checagem mediante leitura vinculada e executa uma investigação com a nova entrada.

Os testes cobrem o resultado individual A4, uma missão sem dados, leituras de CO₂ suspeitas, recursos indisponíveis, encaminhamento humano pelo protocolo sem coleta prévia, investigações antigas e erros HTTP. Uma missão sem perfis retorna `insufficient_data`, cobertura vazia e `needs_context`. Leituras suspeitas podem impedir a comparação ambiental enquanto o achado de sono permanece sustentado. Uma checagem indisponível retorna `unavailable` com o motivo e sem nova tarefa. O encaminhamento pelo protocolo preserva o estado experimental.

A API usa as respostas de erro já definidas. Para HTTP 422/404, mostrar o problema da solicitação e permitir correção. Para falha de leitura ou execução, a tela pode conservar o último resultado confirmado com seu horário e oferecer nova tentativa. Exibir o erro como estado de carregamento, preservando a classificação anterior. As referências acompanham a resposta sem consulta externa durante a análise. [Critérios AKM-08](../akm-08-alert-safety.md) · [Fluxo AKM-04](akm-04-investigation-flow.md)
