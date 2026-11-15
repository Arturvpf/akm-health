# EP-05 · Fundamentação científica e segurança

A ODYSSEY-26 demonstra uma investigação preventiva com quatro perfis fictícios. A evidência da missão é composta por medições simuladas ou manuais. Os recursos NASA fundamentam a escolha dos indicadores e oferecem contexto histórico. A avaliação clínica e as decisões operacionais cabem à equipe responsável pelo protocolo da missão. Épico EP-05 (internal Notion page; Portuguese, not part of the submission) · Arquitetura (internal Notion page; Portuguese, not part of the submission)

## Evidências das tarefas

| Tarefa | Entrega | Evidência |
| --- | --- | --- |
| AKM-06 (internal Notion page; Portuguese, not part of the submission) | Cinco indicadores, zona, unidade, método de registro, frequência demonstrativa e limites de entrada. | [Protocolo de medição](../akm-06-measurement-protocol.md) · [Testes de contrato](../../backend/tests/test_akm06_protocol_contract.py) · [PR #1](https://github.com/Arturvpf/akm-health/pull/1) |
| AKM-07 (internal Notion page; Portuguese, not part of the submission) | Matriz dos cinco perigos, evidências possíveis, hipóteses, incerteza e checagens informativas. | [Fontes e hipóteses](../scientific-sources.md) · [PR #2](https://github.com/Arturvpf/akm-health/pull/2) |
| AKM-08 (internal Notion page; Portuguese, not part of the submission) | Critérios, casos-limite, rótulos, ícones e encaminhamento humano. | [Matriz de segurança](../akm-08-alert-safety.md) · [Testes de classificação](../../backend/tests/test_alerts.py) · [PR #8](https://github.com/Arturvpf/akm-health/pull/8) |
| AKM-09 (internal Notion page; Portuguese, not part of the submission) | Mensagens identificadas por contexto, ação, restrição e fonte. | [Biblioteca de orientações](../akm-09-guidance-library.md) · [PR #8](https://github.com/Arturvpf/akm-health/pull/8) |
| AKM-38 (internal Notion page; Portuguese, not part of the submission) | Telemetria pública RR-1 selecionada com colunas, unidade, período, contexto e verificação contra a publicação original. | [Proveniência RR-1](#proveniência-rr-1) · [NASA EDA](https://visualization.osdr.nasa.gov/eda/) |

### Limites das regras da demonstração

- Apenas `sleep_hours` ativa os detectores de padrão. A regra padrão usa duas datas UTC distintas e utilizáveis em até 48 h, cada duração menor ou igual a 80% da baseline sintética. O coletivo exige pelo menos dois perfis afetados nos mesmos dois períodos UTC. Os números são parâmetros da demo. Frequência cardíaca, humor e temperatura dão contexto.
- CO₂ pode sustentar uma hipótese `unconfirmed` quando existe padrão coletivo de sono, uma referência anterior e duas leituras válidas que variam na mesma direção e se alinham aos períodos pela tolerância configurada. Rotina, fatores individuais e coleta permanecem explicações possíveis. Dados `suspect` ficam no histórico e são excluídos das evidências de classificação.
- Verde representa ausência de padrão com dados suficientes para o escopo. Amarelo representa um padrão experimental a verificar. Cinza representa insuficiência de cobertura. Vermelho (`critical`) é reservado à legenda do P0, com `legend_only=true` e referência ao protocolo. O adaptador apresenta texto, ícone, cor e motivo, e preserva a classificação quando sinaliza novas medições.

[Detector individual](akm-21-individual-detector.md) · [Detector coletivo](akm-22-collective-detector.md) · [Apresentação de alertas](akm-24-alert-presentation.md)

## Proveniência RR-1

**NASA Open Science Data Repository (OSDR), Environmental Data Application (EDA), Rodent Research-1 (RR-1 / SpaceX CRS-4).** A série ambiental publicada separa a cabine da ISS e o controle terrestre. A janela das observações vai de **20/09/2014 03:59 UTC a 01/11/2014 03:54 UTC** e inclui amostras antes do lançamento da carga e depois do retorno. O modelo de cada sensor não está identificado nos exports ou na resposta de telemetria consultados. [Metadados da missão](https://visualization.osdr.nasa.gov/eda/api/missions/RR-1/) · [Telemetria publicada](https://visualization.osdr.nasa.gov/eda/api/missions/RR-1/telemetry_data/)

| Campo no CSV | Campo na API da NASA | Uso previsto |
| --- | --- | --- |
| `Controller_Time_GMT` | `time` | Horário observado em GMT/UTC. Preservar precisão nativa. |
| `Temp_degC_ISS` | `temperature_iss` | Temperatura da cabine da ISS em °C. |
| `RH_percent_ISS` | `humidity_iss` | Umidade relativa da cabine da ISS em %. |
| `CO2_ppm_ISS` | `co2_iss` | CO₂ da cabine da ISS em ppm. |
| `Temp_degC_Ground`, `RH_percent_Ground`, `CO2_ppm_Ground` | `temperature_ground`, `humidity_ground`, `co2_ground` | Controles terrestres nas mesmas unidades, identificados como série própria. |

### Conferência dos exports

Abra o portal EDA e selecione **Data Tables → RR-1**. Use **CSV** nas tabelas de telemetria, radiação e resumo. Compare a telemetria com a API oficial pelo horário à precisão do CSV e pelos seis valores de cada linha. Para a radiação, compare os valores diários a duas casas decimais e recalcule o acumulado a partir do total diário da API antes de arredondar. Para o Summary, recalcule máximo, mínimo, média, desvio-padrão amostral e mediana. [Portal EDA](https://visualization.osdr.nasa.gov/eda/) · [Tutorial oficial](https://github.com/nasa/OSDR_Tutorials/blob/main/source/pages/guides/environmental_data_application.md) · [Série diária de radiação](https://visualization.osdr.nasa.gov/eda/api/missions/RR-1/radiation_data/)

Em 14/11/2026 (Fortaleza), a telemetria baixada da API coincidiu com os **12.087 horários e 72.522 valores** dos exports recebidos. A radiação conferiu em 39 dias na precisão do CSV. As 50 estatísticas do resumo coincidiram a duas casas decimais. Na primeira observação, `2014-09-20T03:59:00Z`, os campos da ISS informam **24,10 °C**, **39%** de umidade relativa e **2.641 ppm** de CO₂. A seleção para a integração do P0 usa apenas as variáveis ambientais da cabine. O rótulo de unidade original da radiação acumulada e a interpretação da soma estão registrados na AKM-38. [API de telemetria](https://visualization.osdr.nasa.gov/eda/api/missions/RR-1/telemetry_data/) · Auditoria da AKM-38 (internal Notion page; Portuguese, not part of the submission)

| Export recebido | SHA-256 da cópia conferida |
| --- | --- |
| `RR-1_EDA_Telemetry_table.csv` | `6f252984805e8e9a1e7d19927f88b70160ebc30fa3cd7e842572f2b806e5a805` |
| `RR-1_EDA_Radiation_table.csv` | `766555cabeb9c5bf101d542acfeb13cef2e9d1e20869908311d6045224095c2b` |
| `RR-1_EDA_Summary_table.csv` | `a1da2c751ef8b246832e131553d7fff4a229b36fe8c684960786aa784b4dc4c0` |

Os hashes identificam os arquivos recebidos. Cite NASA OSDR EDA, RR-1, a URL da série, a data de acesso e a versão da ferramenta quando identificada. Os termos de redistribuição do OSDR remetem à política da NASA, que descreve condições gerais de CC0 para dados de missões lideradas pela NASA. A verificação não encontrou uma declaração específica de licença nos exports e respostas examinados. O acesso aos arquivos permanece pelos canais oficiais. [Termos do OSDR](https://science.nasa.gov/reference/osdr-help-terms-and-conditions/#data-redistribution) · [Licenças de dados científicos NASA](https://science.data.nasa.gov/about/license) · [Orientação de citação](https://science.nasa.gov/reference/osdr-faq/)

## Revisão técnica das integrações

| Integração | Evidência verificada | Aceite a exercer na integração |
| --- | --- | --- |
| Alertas (AKM-21/22/24) | Detectores e apresentação na `main`. O cenário coletivo produz três perfis afetados, hipótese ambiental `unconfirmed` e alerta amarelo. Os testes cobrem insuficiência, leituras suspeitas, dias sobrepostos, verde com dados e vermelho reservado. | Validar no dashboard e na investigação o escopo, a cobertura, os horários e a combinação de texto, ícone e cor. [Apresentação AKM-24](akm-24-alert-presentation.md) · [PR #12](https://github.com/Arturvpf/akm-health/pull/12) · [PR #13](https://github.com/Arturvpf/akm-health/pull/13) |
| Orientações (AKM-14/16/26) | Biblioteca revisada tecnicamente contra estados e cenários. Cada mensagem tem ID, condição, restrições e referência. A seleção de textos para `guidance` aguarda a revisão educativa prevista na AKM-09 e a integração da investigação. | Conferir a orientação retornada para cada contexto, sua origem e o encaminhamento manual quando aplicável. [Biblioteca AKM-09](../akm-09-guidance-library.md) · AKM-26 (internal Notion page; Portuguese, not part of the submission) |
| NASA (AKM-39) | `GET /api/nasa/references` entrega três referências HRP e, após AKM-39, 864 valores do recorte RR-1 com estado `imported`. A ausência/invalidade do histórico conserva o fallback `not_imported`. | Reproduzir a carga local e conferir proveniência e painel histórico separado conforme [AKM-39](../akm-39-nasa-references.md) e [fontes de dados](../data-sources.md), preservando unidade, série, missão e horário nativo. Os registros da ODYSSEY-26 continuam identificados como `manual` ou `synthetic`. [Teste do fallback](../../backend/tests/test_seed.py) · AKM-39 (internal Notion page; Portuguese, not part of the submission) |

### Reprodução local

Com as dependências instaladas conforme o [README](../../README.md), execute na raiz do repositório:

```sh
python scripts/check.py
python scripts/demo_individual_detection.py
python scripts/demo_collective_detection.py
python scripts/demo_alerts.py
```

Os exemplos usam o seed da ODYSSEY-26. No cenário coletivo, A1, A2 e A3 ficam em `attention` e A4 em `normal`. O detector apresenta 680 ppm como referência, 950/980 ppm como leituras alinhadas e duas hipóteses não confirmadas. A apresentação também exercita ausência de dados e a legenda do estado reservado. [Dados sintéticos e cenários](synthetic-data.md)
