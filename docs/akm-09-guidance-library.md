# AKM-09 · Biblioteca de orientações da ODYSSEY-26

Textos curtos para a interface da demonstração, com contexto, limite e fonte por mensagem. Os IDs permitem revisão e implementação nas AKM-14, AKM-16 e AKM-26. A revisão de Pesquisa/Segurança deve confirmar os textos para uso educativo. Até essa aprovação, o campo `guidance` da investigação permanece vazio, conforme a arquitetura. [AKM-06](akm-06-measurement-protocol.md) · [AKM-08](akm-08-alert-safety.md) · [Arquitetura](https://app.notion.com/p/4189432b2222816494fdd66f32e11ec4)

## Instruções de medição

| ID | Mostrar quando | Texto para a interface | Limite e fonte |
| --- | --- | --- | --- |
| MED-SONO | Formulário de sono, com tripulante selecionado | “Estime quantas horas você dormiu no último período completo. Informe o horário em que acordou, com fuso. Se não souber a duração, deixe sem registro.” | Duração estimada de 0 a 24 h. Zero indica que a pessoa efetivamente não dormiu. Mede duração, sem pontuar qualidade ou fase circadiana. [AKM-06](akm-06-measurement-protocol.md) · [NASA HRR, sono](https://humanresearchroadmap.nasa.gov/Risks/risk.aspx?i=100) |
| MED-FC | Formulário de frequência cardíaca | “Selecione o tripulante. Registre a leitura do monitor em bpm e o horário. Para comparar duas leituras, prefira condições semelhantes, como repouso.” | Leitura pontual positiva e finita. O app não verifica repouso, técnica de medição ou precisão do aparelho. [AKM-06](akm-06-measurement-protocol.md) · [NASA, estudos com dispositivos vestíveis](https://www.nasa.gov/humans-in-space/wearable-tech-for-space-station-research/) |
| MED-HUMOR | Formulário de humor | “Como você avalia seu bem-estar emocional agora? Escolha de 1 (muito ruim) a 5 (muito bom).” | Check-in subjetivo de demonstração. A escala usa 2 = ruim, 3 = neutro e 4 = bom. Não é instrumento clínico validado. [AKM-06](akm-06-measurement-protocol.md) · [NASA HRR, saúde comportamental](https://humanresearchroadmap.nasa.gov/risks/risk.aspx?i=99) |
| MED-CO2 | Formulário de CO₂ do habitat ou rechecagem ambiental | “Selecione Habitat. Informe a leitura de CO₂ do ar interno em ppm, o horário e a origem. Se a leitura estiver instável, marque como suspeita.” | Valor finito e não negativo. Aplicar apenas à cabine da missão simulada. A leitura isolada não classifica segurança. [AKM-06](akm-06-measurement-protocol.md) · [NASA OCHMO, CO₂](https://www.nasa.gov/ochmo-tb-004-carbon-dioxide-2/) |
| MED-TEMP | Formulário de temperatura do habitat | “Selecione Habitat. Registre a temperatura do ar interno em °C e o horário da leitura.” | Valor finito. Cabine interna, distinta da temperatura corporal e do ambiente externo de Marte. [AKM-06](akm-06-measurement-protocol.md) · [NASA HRP, ambiente fechado](https://www.nasa.gov/hrp/hazards/) |

Para todas as medições, a interface pede data, horário e fuso explícito e distingue **Registro manual** de **Simulado**. A origem **NASA histórica** aparece somente na área de referências. O envio inclui o ID do tripulante nas três métricas individuais e usa `null` ou omite o ID nas métricas do habitat. [Contrato AKM-03/18](contracts-v2-review.md)

## Estados e próximas ações

| ID | Mostrar quando | Texto para a interface | Limite e fonte |
| --- | --- | --- | --- |
| EST-NORMAL | Investigação com dados suficientes e sem padrão no escopo | “A regra da demonstração não identificou um padrão {no perfil / na tripulação}. Veja o período e os perfis avaliados.” | Escolher a variante pelo escopo. Um resultado coletivo pode coexistir com um achado individual. Exibir o horário e a cobertura. [Matriz AKM-08](akm-08-alert-safety.md) |
| EST-ATENCAO | `attention` com alteração no sono | “A regra da demonstração encontrou redução de sono em {perfis}. Veja as leituras e a referência de cada perfil.” | Preencher `{perfis}` com os nomes do achado. A regra compara duração com baseline sintética, sem interpretação clínica. [Matriz AKM-08](akm-08-alert-safety.md) · [NASA HRR, sono](https://humanresearchroadmap.nasa.gov/Risks/risk.aspx?i=100) |
| EST-SEM-DADOS | `insufficient_data` | “Ainda faltam leituras comparáveis para avaliar este escopo. {lacuna}” | Preencher `{lacuna}` com o dado ausente, por exemplo “Falta a segunda leitura de sono de Orion”. Exibir nova coleta somente se for viável. [Matriz AKM-08](akm-08-alert-safety.md) |
| EST-SUSPEITO | A leitura foi marcada como `suspect` | “A leitura está no histórico como suspeita. Confira o instrumento, a unidade e o horário antes de registrar uma nova leitura.” | Descreve qualidade técnica. A evidência permanece fora da regra enquanto suspeita. [AKM-06](akm-06-measurement-protocol.md) · [Matriz AKM-08](akm-08-alert-safety.md) |
| EST-COINCIDENCIA | Padrão de sono e mudança de CO₂ em janela comparável | “A mudança de CO₂ ocorreu no mesmo período que a redução de sono. A relação entre as duas observações permanece em aberto.” | Usar com hipótese `unconfirmed` e somente com a evidência ambiental que sustenta a comparação. [Fundamentação AKM-07](scientific-sources.md) · [NASA OCHMO, CO₂](https://www.nasa.gov/ochmo-tb-004-carbon-dioxide-2/) |
| EST-SEM-AMBIENTE | Achado de sono sustentado, com CO₂ ausente, suspeito ou fora da janela | “A redução de sono foi observada. Faltam leituras de CO₂ confiáveis no período para avaliar uma coincidência.” | Manter o achado de sono. Apontar o motivo concreto da lacuna ambiental quando disponível. [Matriz AKM-08](akm-08-alert-safety.md) |
| ACAO-CO2 | `next_check.kind=co2_ppm` | “Registre uma nova leitura de CO₂ do habitat e vincule-a à verificação. Depois, atualize a investigação.” | Usar o tipo e alvo escolhidos pelo motor. A nova leitura pode conferir o padrão ambiental. Não comprova causa de um achado humano. [Fluxo AKM-04](akm-04-investigation-flow.md) · [Fundamentação AKM-07](scientific-sources.md) |
| ACAO-SONO | `next_check.kind=sleep_hours` | “Registre as horas dormidas por {perfil} no próximo período completo. Use esse registro para atualizar a investigação.” | O motor fornece o perfil. A janela e a próxima medição seguem a regra da demo. [AKM-06](akm-06-measurement-protocol.md) · [Matriz AKM-08](akm-08-alert-safety.md) |
| EST-NOVA | `has_unanalyzed_measurements=true` | “Há novas medições. Atualize a investigação para incluí-las.” | Exibir o último horário de análise, se existir. Registro e investigação são ações separadas. [Contrato AKM-03/18](contracts-v2-review.md) |
| EST-PROTOCOLO | Legenda de `critical` ou instrução de protocolo solicitada pela pessoa | “Consulte o protocolo da missão e procure o responsável designado. Se o protocolo indicar encaminhamento imediato, siga-o agora.” | Texto informativo. `critical` fica reservado e o motor da demo não o gera. [Matriz AKM-08](akm-08-alert-safety.md) · [NASA HRR, condições médicas em missão](https://humanresearchroadmap.nasa.gov/Risks/risk.aspx?i=95) |
| ACAO-REVISAO | Padrão persistente após rechecagem, coletas repetidas sem sucesso ou pedido de ajuda | “Leve as leituras, seus horários e as verificações já feitas ao responsável da missão para revisão.” | Encaminhamento manual. A equipe da missão decide os próximos passos conforme protocolo. [Fluxo AKM-04](akm-04-investigation-flow.md) · [Matriz AKM-08](akm-08-alert-safety.md) |
| ERRO-ENTRADA | HTTP 422 | “Revise o campo indicado e tente salvar novamente.” | Exibir campo e motivo do erro. Preservar o conteúdo do formulário. [Contrato AKM-03/18](contracts-v2-review.md) |
| ERRO-ALVO | HTTP 404 para tripulante no registro | “O tripulante selecionado não está disponível. Atualize a lista e selecione novamente.” | Preservar demais campos. [Contrato AKM-03/18](contracts-v2-review.md) |
| ERRO-REDE | Falha de rede ou resposta inesperada | “Não foi possível confirmar a operação. Confira se o registro aparece no histórico antes de reenviar.” | Para falha de leitura, preservar o último resultado confirmado e permitir nova tentativa. [Fluxo AKM-04](akm-04-investigation-flow.md) |

## Conferência das mensagens

| Entrada da demo | Mensagens e alcance |
| --- | --- |
| Coletivo da AKM-28 | EST-ATENCAO com Aurora, Orion e Vega. EST-COINCIDENCIA com o CO₂ em janela comparável. ACAO-CO2 como checagem. |
| Individual da AKM-28 | EST-ATENCAO para Aurora. ACAO-SONO para a próxima medição. A hipótese ambiental fica ausente porque o CO₂ estável não sustenta a comparação. |
| Insuficiente da AKM-28 | EST-SEM-DADOS com a lacuna de sono no coletivo. A alteração individual de Aurora pode ser vista no escopo correspondente. |
| CO₂ suspeito, ausente ou fora da janela | EST-SEM-AMBIENTE acompanha o achado de sono, e EST-SUSPEITO identifica a leitura quando houver. O motivo determina a coleta disponível. |
| Registro inválido ou resposta perdida | ERRO-ENTRADA, ERRO-ALVO ou ERRO-REDE conforme o resultado da operação. |
| Rechecagem válida e nova medição | EST-NOVA até acionar a investigação. ACAO-REVISAO se o padrão persistir ou houver solicitação de ajuda. |

Use os [dados da AKM-28](synthetic-data.md#cenários-de-investigação-da-akm-28) para reproduzir esta conferência. Os textos de estado acompanham o resultado da investigação, com motivo, ícone e horário. O app só mostra a ação de verificar quando houver próxima medição aplicável. O vínculo da medição ao follow-up e a sequência no navegador serão exercitados na integração.
