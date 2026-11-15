# AKM-22 — Padrões coletivos e ambiente

[Tarefa](https://app.notion.com/p/4189432b2222812badaae0da3c4ea775) · [Arquitetura](https://app.notion.com/p/4189432b2222816494fdd66f32e11ec4) · [Matriz AKM-08](akm-08-alert-safety.md)

`detect_collective_patterns` em `backend/app/rules.py` aplica DR-02/03/04 como função pura. Reutiliza a AKM-21, sem persistir dados ou adicionar endpoints. O snapshot contém perfis únicos ordenados por ID, histórico único ordenado por `(measured_at, id)` e `as_of` explícito em UTC. Cada perfil pode ter baseline ausente para que a insuficiência fique explícita.

## Sono e cobertura

A configuração inclui a regra individual (padrão: 48 h e proporção 0,8) e tolerância ambiental (padrão: 12 h, podendo ser zero). Todos são parâmetros de demonstração, não cortes clínicos.

Só há comparação coletiva com pelo menos dois perfis com baseline e dois períodos úteis nos **mesmos dois dias UTC**. A data mantém a aproximação de período documentada na AKM-21. Quando existem vários grupos comparáveis, escolhe-se o par de períodos mais recente; padrões antigos não são promovidos a resultado do grupo atual. A saída preserva os resultados individuais de todos os perfis, inclusive dos que ficaram fora desse grupo.

- Menos de dois perfis comparáveis: `insufficient_data`.
- Pelo menos dois perfis do grupo comparável em `attention` individual: `attention` coletivo.
- Grupo suficiente sem esse padrão: `normal` coletivo, mesmo que um perfil tenha alteração individual.

`sufficient_astronaut_ids` lista os perfis suficientes individualmente; `comparable_astronaut_ids` identifica o grupo efetivamente comparado; `affected_astronaut_ids` identifica os perfis alterados desse grupo. Cada resultado individual mantém suas evidências. A saída inclui janela, períodos, versão, achados e limitações. Nenhuma regra retorna `critical`.

## Evidência ambiental

Somente CO₂ e temperatura internos (`astronaut_id=null`), qualidade `ok`, observados dentro da janela e registrados até `as_of` são utilizáveis. Leituras repetidas no mesmo timestamp contam uma vez, escolhendo o maior ID utilizável. Dados NASA externos ou históricos não entram no schema de medições da missão.

Para cada métrica, buscar uma leitura distinta para cada período, dentro da tolerância de **todos** os horários de sono do grupo naquele período. Selecionar o par ordenado com a segunda leitura mais recente e, antes dela, a primeira mais recente. Isso também funciona quando as janelas de tolerância se sobrepõem. A referência é a leitura utilizável mais recente estritamente anterior à primeira leitura alinhada, ainda dentro da janela.

Uma mudança consistente exige referência e duas leituras alinhadas, ambas acima ou ambas abaixo da referência. A desigualdade é estrita; valores inalterados ou em direções opostas não sustentam a mudança. Não há limiar de segurança inventado: é apenas comparação descritiva do cenário sintético. A saída expõe IDs, valores, unidades, origem e horários, além do motivo quando falta suporte.

Somente um padrão coletivo de sono junto de mudança consistente de CO₂ gera a hipótese de coincidência ambiental, sempre `unconfirmed`. Para `attention`, também se apresentam explicações alternativas não verificadas: rotina, fatores individuais e condições da coleta. Sem referência, com dados suspeitos/ausentes ou fora da janela, o achado de sono permanece e a hipótese ambiental fica ausente. A temperatura é contexto descritivo e não altera o status nem gera diagnóstico.

## Reprodução e validação

```sh
python scripts/demo_collective_detection.py
python -m pytest -q backend/tests/test_collective_rules.py
python scripts/check.py
```

O exemplo usa o seed em memória: A1/A2/A3 alterados, `attention` coletivo, referência de CO₂ 680 ppm e leituras alinhadas 950/980 ppm, com hipótese de coincidência e alternativa, ambas não confirmadas. O cenário individual preserva A1 em atenção e o grupo sem padrão; o insuficiente preserva A1 com dados e informa ausência de cobertura coletiva.

Os testes cobrem esses cenários, ambiente ausente/suspeito/antigo/inalterado, referência zero ou ausente, registros futuros, repetição de sensor, tolerância zero/ampla, períodos incompatíveis, escolha do grupo mais recente, validações de entrada e determinismo sem mutação do snapshot. Persistência e próxima medição continuam nas AKM-20 e AKM-23.
