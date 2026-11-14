# AKM-08 · Critérios de alerta e revisão humana

Aplicação à demonstração ODYSSEY-26. A validação técnica pertence ao contrato de entrada. O estado de investigação descreve um padrão experimental no escopo avaliado. A avaliação clínica e as decisões operacionais cabem à equipe responsável pelo protocolo da missão. [Arquitetura v2.0/v2.1](https://app.notion.com/p/4189432b2222816494fdd66f32e11ec4) · [Protocolo AKM-06](akm-06-measurement-protocol.md) · [Fundamentação AKM-07](scientific-sources.md)

## Matriz de decisão

Avalie primeiro a suficiência dos dados, depois a regra de sono. Uma leitura válida de CO₂ pode ajudar a escolher uma checagem quando há mudança ambiental em janela comparável. Seu valor isolado, temperatura, frequência cardíaca e humor permanecem como observações de contexto no motor P0.

| Estado | Condição da demo | Rótulo, cor e ícone | Ação e limite | Fonte |
| --- | --- | --- | --- | --- |
| `insufficient_data` | Escopo individual sem baseline positiva ou sem duas leituras de sono recentes, distintas e utilizáveis. Escopo coletivo com menos de dois perfis que satisfaçam essas condições em janela comparável. | **Dados insuficientes**, cinza, ícone de informação | Dizer o que falta. Se a coleta for viável, pedir uma observação que preencha a lacuna. | DR-01/04 · [Arquitetura](https://app.notion.com/p/4189432b2222816494fdd66f32e11ec4) |
| `normal` | Dados suficientes no escopo e nenhum padrão que satisfaça a regra desse escopo. Uma mudança individual pode coexistir com ausência de padrão coletivo. | **Sem padrão pela regra da demo**, verde, ícone de confirmação | Exibir a janela e os perfis efetivamente avaliados. O resultado tem alcance restrito à regra e aos dados usados. | DR-01/02/07 · [Arquitetura](https://app.notion.com/p/4189432b2222816494fdd66f32e11ec4) · [NASA HRR, sono e desempenho](https://humanresearchroadmap.nasa.gov/Risks/risk.aspx?i=100) |
| `attention` | No escopo individual, as duas leituras válidas ficam em até 80% da baseline sintética. No coletivo, pelo menos dois perfis cumprem a regra na mesma janela. | **Padrão experimental a verificar**, amarelo, ícone de atenção | Exibir achado, leituras e uma próxima checagem. Se houver mudança comparável de CO₂, mostrar a hipótese de coincidência como `unconfirmed`. Sem comparação ambiental confiável, manter o achado de sono e explicitar a lacuna. | DR-01 a DR-05 · [Arquitetura](https://app.notion.com/p/4189432b2222816494fdd66f32e11ec4) · [NASA HRR, sono](https://humanresearchroadmap.nasa.gov/Risks/risk.aspx?i=100) · [NASA OCHMO, CO₂](https://www.nasa.gov/ochmo-tb-004-carbon-dioxide-2/) |
| `critical` | Estado reservado no contrato para um futuro protocolo operacional aprovado. Nenhuma regra ou medição da demo gera este estado automaticamente. | **Seguir protocolo da missão**, vermelho, ícone de alerta, apenas na legenda do P0 | Em uma situação comunicada como urgente ou coberta pelo protocolo da missão, orientar a procurar o responsável designado sem aguardar coleta ou reanálise. O app preserva seu estado experimental. | DR-07 · [Arquitetura](https://app.notion.com/p/4189432b2222816494fdd66f32e11ec4) · [NASA HRR, condições médicas em missão](https://humanresearchroadmap.nasa.gov/Risks/risk.aspx?i=95) |

O limite inclusivo de 80% e a regra de dois perfis são parâmetros do software definidos pela arquitetura. As fontes NASA fundamentam a relevância dos indicadores e o contexto da missão. Um status experimental jamais autoriza diagnóstico, prescrição, prognóstico, alteração de equipamento ou declaração de segurança. Telemetria histórica RR-1 e dados externos de Marte servem como referência contextual e ficam fora do cálculo da missão.

## Dados, erros e apresentação

- Duas leituras precisam representar períodos de sono distintos dentro da janela configurada pelo motor. Duplicar uma leitura ou repetir o mesmo período não aumenta a cobertura. Uma leitura de sono de 0 h, se efetivamente observada e utilizável, conta como valor. Ausência permanece ausente.
- `quality=suspect` preserva a leitura no histórico e a exclui da evidência que sustenta a classificação. Se sobram dados suficientes, classificar pelos dados restantes. Se sobra apenas uma noite útil em um perfil, declarar insuficiência no escopo individual. Um problema de CO₂ isolado reduz a evidência ambiental, mantendo o achado de sono quando sustentado.
- Erro HTTP é estado da interface. Ao receber 422, conservar o formulário e apontar o campo inválido. Em indisponibilidade, manter o último resultado confirmado à vista, identificado pelo horário. Medições novas ficam sinalizadas até reanálise explícita. Um erro de rede, dado novo ou leitura inválida não muda sozinho a classificação da última análise.
- Mostrar texto e ícone além da cor, com escopo, motivo, horário e janela das leituras. Informar quantos perfis têm dados suficientes. Separar achado observado, hipótese e checagem sugerida.

## Encaminhamento humano

1. Para `attention`, oferecer uma verificação viável e explicar o que ela pode esclarecer. Em `insufficient_data`, orientar sobre a primeira lacuna relevante ou indicar que a fonte de coleta está indisponível.
2. Se o padrão persistir após rechecagem, as coletas repetidas falharem ou a pessoa solicitar ajuda, oferecer a revisão pelo responsável da missão. O resumo reúne escopo, dados e horários, qualidade, lacunas e verificações já feitas. O envio é manual.
3. Quando o protocolo da missão orientar encaminhamento imediato, seguir o canal humano definido. O aplicativo não decide se uma ocorrência real é grave e a rechecagem da demo não é pré-requisito para procurar ajuda.

[Fluxo AKM-04](akm-04-investigation-flow.md) · [Pesquisa NASA HRR sobre condições médicas em missão](https://humanresearchroadmap.nasa.gov/Risks/risk.aspx?i=95)

## Conferência com o cenário sintético

Compare as duas noites da [fixture da AKM-28](../backend/tests/fixtures/odyssey-26-scenarios.json) com 0,8 × baseline. As leituras do coletivo colocam A1, A2 e A3 em `attention` no escopo individual e sustentam o achado coletivo. A4 tem dados suficientes e não ativa a regra individual. No cenário individual, A1 ativa a regra e três perfis permanecem fora dela. No cenário insuficiente, apenas A1 tem duas noites comparáveis, e o coletivo fica em `insufficient_data`.

| Caso-limite | Resultado esperado |
| --- | --- |
| Baseline 8 h, noites de 6,4 h e 6,4 h | `attention` individual. A igualdade está incluída. |
| Baseline 8 h, noites de 6,4 h e 6,41 h | `normal` individual para a regra do sono, com dados suficientes. |
| Duas entradas do mesmo período ou uma das duas com qualidade suspeita | `insufficient_data` individual se resta apenas um período útil. |
| Um perfil com alteração e outros perfis comparáveis sem alteração | `normal` para o padrão coletivo, com achado individual preservado quando consultado. |
| A1/A2/A3 com padrão de sono e CO₂ ausente, suspeito ou fora da janela | `attention` coletivo pelo sono, sem hipótese ambiental sustentada por essas leituras. |
| Mudança do CO₂ sem padrão de sono, com sono suficiente | `normal` pela regra de sono. Apresentar dados ambientais como contexto. |
| A1/A2/A3 com mudança e CO₂ comparável na mesma janela | `attention` coletivo com hipótese `unconfirmed`. Priorizar nova medição de CO₂. |
| Pedido de revisão humana ou encaminhamento do protocolo | Disponibilizar o canal humano aplicável. Nenhuma promoção automática para `critical`. |

Esta conferência valida a consistência dos critérios da demo. A revisão de Pesquisa/Segurança e os testes do motor são etapas separadas, documentadas nas AKM-21/24/29.
