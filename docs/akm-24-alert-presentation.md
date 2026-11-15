# AKM-24 — Status e mensagens de alerta

[Tarefa](https://app.notion.com/p/4189432b2222815fb962d6902f7a7696) · [Matriz AKM-08](akm-08-alert-safety.md) · [Arquitetura](https://app.notion.com/p/4189432b2222816494fdd66f32e11ec4)

`backend/app/alerts.py` apresenta um status já calculado pelo motor. Não recebe valores brutos de sensores, não inventa limiares, não executa o motor e não grava dados. A função pura `present_individual_alert` traduz diretamente os resultados da AKM-21; `present_alert` recebe um `AlertContext` tipado para escopos individual ou coletivo.

## Catálogo

| Status | Rótulo | Cor | Ícone | Grau de atenção |
| --- | --- | --- | --- | --- |
| `normal` | Sem padrão pela regra da demo | green | circle-check | routine |
| `attention` | Padrão experimental a verificar | yellow | triangle-alert | verify |
| `insufficient_data` | Dados insuficientes | gray | info | missing_data |
| `critical` | Seguir protocolo da missão | red | siren | reserved_protocol |

A matriz AKM-08 e DR-07 determinam que vermelho/critical fique **somente na legenda do P0**, reservado a protocolo autorizado. `alert_legend()` o expõe com `legend_only=true`, enquanto `AlertContext` rejeita `critical`. Assim, verde/amarelo/vermelho são reproduzíveis na legenda sem acionar um alerta médico por uma regra sintética. Dados insuficientes são cinza, nunca normal/verde por ausência.

Texto, ícone e cor sempre viajam juntos. As cores são tokens semânticos, e os ícones são identificadores para a camada visual. Contraste, tema e renderização acessível pertencem ao design system/frontend; este módulo entrega a descrição estruturada sem depender apenas da cor.

## Contexto, rastreabilidade e atualização

`AlertContext` contém status, escopo, alvo, versão de regras, horário, início da janela, achados, limitações, IDs de evidência e perfis avaliados. Valida escopo/alvo, horários UTC com fuso, ordem da janela, texto não vazio e IDs únicos ordenados. O escopo individual só admite cobertura do seu próprio alvo. A saída preserva o contexto completo, acrescenta o estilo, a explicação, a quantidade de perfis avaliados e uma mensagem de atualização quando aplicável. As estruturas são imutáveis.

`has_unanalyzed_measurements=true` acrescenta “Novas medições disponíveis — atualizar investigação”. Não recalcula o estado nem altera sua cor. Carregamento, erro HTTP, falha de rede e dado novo não são classificações de investigação; `loading`, `error` e estados desconhecidos são rejeitados. A interface deve manter o último resultado confirmado e seu horário durante essas situações.

O adaptador individual preserva exatamente os achados, as limitações e os IDs de evidência do detector. Informa um perfil suficiente quando o resultado não é `insufficient_data`, e zero em caso de insuficiência. Para o coletivo, o chamador compõe `AlertContext` a partir do resultado do detector: `scope=crew`, alvo nulo e IDs dos perfis efetivamente comparáveis. Hipóteses continuam no resultado da investigação e devem ser apresentadas separadas dos achados e com sua incerteza; o apresentador não as promove a fatos.

Este é um contrato interno de apresentação; não altera os dez endpoints canônicos nem substitui o schema HTTP de `DashboardAlert`/`InvestigationResult`. IDs de investigação, composição HTTP e persistência continuam nas tarefas correspondentes. As mensagens genéricas não escolhem a próxima medição nem criam verificações (AKM-23/25).

## Reproduzir

```sh
python scripts/demo_alerts.py
python -m pytest -q backend/tests/test_alerts.py
python scripts/check.py
```

O exemplo executa o detector individual sobre o seed e mostra três apresentações amarelas, uma verde, uma demonstração cinza de dados ausentes e a legenda com vermelho reservado. Os testes verificam cores/textos/ícones, limites da regra real, dados insuficientes, preservação de status após novos dados, escopo coletivo, incerteza, entradas inválidas, imutabilidade e determinismo. Nenhuma mensagem representa diagnóstico, prescrição ou declaração de segurança.
