# AKM-21 — Detector individual de alterações

[Tarefa](https://app.notion.com/p/4189432b22228117a953d9551cd76989) · [Arquitetura canônica](https://app.notion.com/p/4189432b2222816494fdd66f32e11ec4) · [Matriz de segurança AKM-08](akm-08-alert-safety.md)

`backend/app/rules.py` implementa DR-01 e a suficiência individual de DR-04. A função `detect_individual_changes(snapshot, rules_version, config)` recebe dados tipados, devolve um `IndividualDetection` explicável e não acessa banco, relógio, rede ou arquivos. Não grava alertas nem cria verificações.

## Contrato interno

- `IndividualSnapshot`: ID do astronauta, baseline sintética de sono (pode estar ausente), `as_of` com fuso explícito e tupla de `MeasurementRead` ordenada por `(measured_at, id)`. Os IDs precisam ser únicos. Datas são normalizadas em UTC pelos schemas existentes.
- `IndividualRuleConfig`: janela positiva, padrão 48 horas, e proporção de sono entre 0 e 1, padrão 0,8. São parâmetros da demonstração, não limiares clínicos. Mudanças nos parâmetros devem acompanhar a identificação da versão de regras na futura composição da investigação.
- `rules_version`: obrigatório e não vazio. `as_of` é fornecido pelo chamador; a execução não usa a hora atual.
- `IndividualDetection`: alvo, versão, regra, estado, janela, baseline, limite calculado, evidências com IDs/horários/valores/unidades, IDs suspeitos excluídos, achados e limitações. Saídas são imutáveis e marcadas `demo_only=true`.

Este é um resultado interno do detector, não uma nova resposta HTTP. A composição com o schema canônico `InvestigationResult`, fingerprint e persistência continua nas tarefas seguintes. A AKM-22 analisa o coletivo e o ambiente; AKM-23 escolhe a próxima medição; AKM-20 persiste; AKM-24 trata a apresentação dos alertas. Nenhum endpoint ou tabela foi adicionado nesta tarefa.

## Seleção de evidência e decisões

1. Selecionar somente sono do astronauta pedido. Leituras de outros perfis, CO₂, temperatura, humor e frequência cardíaca não alteram a classificação individual. O schema de medição não aceita origem NASA.
2. Usar a janela inclusiva `[as_of - window, as_of]` pelo horário observado. Excluir também registros cujo `recorded_at` é posterior a `as_of`, pois ainda não estariam disponíveis naquele momento. Dados antigos ou futuros não preenchem lacunas.
3. Excluir `quality=suspect` da evidência e listar seus IDs quando pertencem ao alvo e à janela. Se ainda há dois períodos úteis, avaliar normalmente pelos dados restantes.
4. O contrato atual não contém um ID de período de sono. **Decisão da demo:** usar a data UTC como aproximação do período. Para cada data, selecionar a leitura utilizável mais recente por `(measured_at, id)`; depois usar as duas datas mais recentes. Duas entradas da mesma data, mesmo com horários diferentes, não representam duas noites. Uma repetição suspeita não substitui uma leitura útil.
5. Baseline ausente ou não positiva, ou menos de dois períodos úteis, produz `insufficient_data`, com motivo explícito. Baselines não finitas, unidades inválidas, histórico desordenado/IDs repetidos, referências sem fuso e configurações inválidas são erros de entrada (`ValidationError`/`ValueError`), não estados normais.
6. Com baseline positiva e dois períodos, **ambos** precisam ser menores ou iguais a `baseline × sleep_ratio` para `attention`. A comparação usa decimais das representações dos números para preservar a igualdade inclusiva. Sono observado de 0 h é um dado, não ausência.
7. Com dados suficientes e sem cumprir a condição, produzir `normal`, significando apenas ausência desse padrão pela regra da demo. A função nunca produz `critical`, diagnóstico, prescrição ou hipótese causal.

A aproximação por data UTC pode agrupar coletas de períodos reais diferentes ou separar um período real que atravesse a meia-noite. Não serve para sono real de turnos ou escalas planetárias; uma futura evolução precisa de um identificador explícito de período. O resultado expõe as datas usadas para que essa limitação fique rastreável. A janela de 48 h foi escolhida para abranger as duas noites do seed, é configurável e não constitui intervalo de avaliação médica.

## Reproduzir

Com as dependências do README instaladas, na raiz do repositório:

```sh
python scripts/demo_individual_detection.py
python -m pytest -q backend/tests/test_individual_rules.py
python scripts/check.py
```

A demonstração usa apenas dados em memória do seed oficial e IDs locais ao exemplo. Retorna `attention` para A1, A2 e A3, e `normal` para A4, com duas evidências por perfil. Não é uma investigação coletiva nem salva registros. Os testes também aplicam as fixtures individual e insuficiente da AKM-28.

Os testes cobrem a igualdade de 80%, valores acima do limite, precisão decimal, sono zero, dados ausentes/suspeitos, duplicações, atualização de um período, janela inclusiva, dados futuros/antigos, separação de alvo/métrica, configuração explícita, erros de entrada, imutabilidade da saída e repetição determinística sem alterar o snapshot.
