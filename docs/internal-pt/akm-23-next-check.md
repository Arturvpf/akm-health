# AKM-23 — Próxima checagem informativa

Tarefa (internal Notion page; Portuguese, not part of the submission) · Arquitetura (internal Notion page; Portuguese, not part of the submission) · [Pesquisa AKM-07](../scientific-sources.md) · [Segurança AKM-08](../akm-08-alert-safety.md)

`prioritize_next_check` em `backend/app/next_check.py` é uma função pura. Recebe snapshot individual ou coletivo, versão de regras, catálogo explícito de recursos, configuração do detector e, opcionalmente, um protocolo validado informado pelo chamador. Reutiliza as AKM-21/22 e devolve **uma** checagem viável ou uma explicação para não selecionar nenhuma. Não acessa banco, arquivos, rede ou relógio, não cria follow-ups nem altera alertas.

## Contrato

- `CheckTarget`: métrica e astronauta; sono/frequência/humor exigem ID não vazio e CO₂/temperatura exigem alvo nulo (habitat).
- `CheckResource`: alvo, disponibilidade e esforço (`low`, `medium`, `high`). A ausência no catálogo significa indisponibilidade; nunca se presume que um instrumento está disponível. IDs fora do escopo podem existir em um catálogo compartilhado, mas não são escolhidos pela regra desse escopo. Alvos repetidos no catálogo são erro de configuração.
- `NextCheckSelection`: escopo, horário, versão do detector, `policy_version=demo-priority-v1`, estado da seleção, estado do detector, candidatos com fatores/pontuação, alternativa utilizada, referência de protocolo, motivo e limitações.
- Quando existe seleção, `next_check` contém **somente** os quatro campos canônicos: `kind`, `astronaut_id`, `reason`, `effort`. Sem recurso viável, retorna `next_check=null`, sem criar alvo fictício ou medição incompatível.

Este contrato é interno. A composição com `InvestigationResult` e a persistência ficam na AKM-20; não há nova tabela ou endpoint. A futura fingerprint precisa considerar todas as entradas que alteram o resultado: snapshot, configuração, versões, recursos e protocolo.

## Política demonstrativa de pontuação

O score é `3 × valor_informativo + necessidade_de_qualidade − penalidade_de_esforço`. Informação e necessidade de qualidade variam de 0 a 100. Penalidades: baixo esforço 0, médio 20 e alto 40. A disponibilidade tem score 100 ou 0 e atua como **condição obrigatória de elegibilidade**, não como probabilidade. Candidatos indisponíveis continuam visíveis nos diagnósticos, mas nunca são selecionados. Quando o recurso nem foi informado, esforço é nulo: não se estima um custo; seu score diagnóstico não recebe penalidade e continua inelegível.

Esses números são prioridades de software explicáveis, não utilidade clínica validada nem porcentagens de risco. A tabela fecha a política padrão desta versão:

| Situação | Informação | Necessidade de qualidade | Motivo |
| --- | ---: | ---: | --- |
| Padrão coletivo com mudança consistente de CO₂ | 100 | 50 | Confirmar outra leitura interna; a hipótese segue não confirmada. |
| Padrão coletivo sem referência ou sem duas leituras ambientais alinhadas | 95 | 100 | Preencher/validar a coleta ambiental necessária. |
| Padrão coletivo com CO₂ suficiente sem mudança consistente | 35 | 10 | Menor informação adicional; acompanhamento do sono pode vencer. |
| Sono com uma observação útil e cobertura insuficiente | 100 | 100 | Um período distinto adicional pode reduzir a lacuna. |
| Sono sem observação útil, com baseline conhecida | 80 | 100 | Iniciar nova coleta; uma única leitura ainda não completa dois períodos. |
| Perfil alterado | 80 | 20, ou 40 com leituras suspeitas excluídas | Repetir registro e conferir horário/rotina da coleta. |
| Perfil incompleto quando já existe padrão coletivo suficiente | 50 | 70 | Alternativa de cobertura; não ultrapassa a confirmação ambiental do grupo. |
| Grupo sem períodos comparáveis, com pelo menos dois perfis individualmente suficientes | 90 se o último período é antigo; 70 caso contrário | 80 | Coletar período distinto para alinhar a cobertura quando as opções para preencher lacunas individuais estiverem indisponíveis. |
| Temperatura interna com padrão coletivo | 25 | 20 | Contexto adicional, sem substituir confirmação de CO₂. |

Baselines ausentes/não positivas não são corrigidas por uma medição inventada: o perfil sem baseline não gera proposta automática de sono. Roster vazio ou ausência de alvo adequado gera `needs_context`. Sem padrão nem lacuna relevante, `no_check_needed`; a rotina programada é responsabilidade das tarefas seguintes. Um resultado coletivo normal pode ainda originar checagem de um perfil individual alterado ou incompleto, sem promover o grupo a alerta.

Aplicar primeiro a prioridade do protocolo, quando houver. Na insuficiência coletiva, as coletas para preencher lacunas individuais vêm antes das coletas de alinhamento. Dentro de cada grupo, ordenar por score decrescente, menor penalidade de esforço e chave estável `(kind, astronaut_id)`. Escolher o primeiro disponível. Se opções anteriores estiverem indisponíveis, marcar `used_alternative=true`, preservar os candidatos rejeitados e explicar a alternativa no próprio `reason`. Frequência cardíaca e humor só podem ser selecionados aqui por instrução de protocolo explícita.

## Protocolos e limites

`ValidatedProtocol` exige referência não vazia e `validated=true` explícito. Isso é uma declaração do integrador: **o módulo não comprova validação científica ou autorização operacional**. Nenhum protocolo real aprovado foi adicionado nesta entrega.

- `action=human_review`: devolve `protocol_referral`, sem executar detector nem aguardar checagem, inclusive quando a configuração de recursos não é aplicável ao encaminhamento. Não envia mensagem a ninguém.
- `action=measurement`: a lista ordenada `permitted_checks` tem precedência sobre o score demonstrativo. Só uma dessas checagens pode ser escolhida; indisponibilidade da primeira permite apenas uma alternativa autorizada na própria lista. Se nenhuma está disponível, retornar `unavailable`, sem substituir por opção fora do protocolo.
- Alvo de protocolo fora do escopo, protocolo sem validação explícita ou forma incoerente gera erro de entrada. Nenhuma regra ativa estado médico `critical`, diagnóstico, prescrição ou ajuste de equipamento.

## Reproduzir

```sh
python scripts/demo_next_check.py
python -m pytest -q backend/tests/test_next_check.py
python scripts/check.py
```

Com recursos da demonstração explicitamente disponíveis, o cenário coletivo escolhe CO₂ do habitat; o individual escolhe sono de A1; o insuficiente escolhe sono de A2. Sem CO₂, o coletivo escolhe uma alternativa disponível de sono; se só temperatura estiver viável, a mensagem declara que é contexto adicional. Sem recursos, não há checagem fictícia.

Os testes usam as fixtures oficiais e cobrem qualidade ausente/suspeita/fora da janela, cobertura parcial, disponibilidade e esforço, desempate estável, alternativa e ausência total de recursos, normalidade, baselines/roster ausentes, preservação de achados individuais, precedência e encaminhamento de protocolo, alvos inválidos, contrato canônico, determinismo e ausência de mutação. As limitações dos detectores (incluindo período aproximado por data UTC) acompanham o resultado.
