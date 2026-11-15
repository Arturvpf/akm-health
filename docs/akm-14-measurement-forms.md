# AKM-14 · Registro guiado de medições

A rota #/registrar consulta a missão e os perfis de GET /api/dashboard e envia uma medição por POST /api/measurements. O contrato HTTP/Python/TypeScript existente foi preservado; não há migração nem endpoint novo.

## Comportamento

- Cinco indicadores: sono (0–24 h), frequência cardíaca (>0 bpm), bem-estar emocional (inteiro 1–5), CO₂ interno (≥0 ppm) e temperatura do ar interno (finita, inclusive negativa). São validações técnicas, sem limiares clínicos.
- Tripulante obrigatório nas métricas pessoais, escolhido exclusivamente entre perfis da API. Habitat envia astronaut_id=null. O servidor deriva measurement_zone e recorded_at.
- Valores vazios permanecem ausentes; zero só é aceito quando informado e permitido. O campo numérico aceita vírgula decimal sem separador de milhares.
- Data/hora e offset UTC explícito são obrigatórios. O offset inicial +00:00 é mostrado como UTC e pode ser alterado; não é inferido do computador. Calendários inválidos são rejeitados e o instante enviado é normalizado para UTC.
- Origem manual ou synthetic, qualidade ok ou suspect. Manual continua sendo um registro desta demonstração fictícia. NASA histórica não é uma opção de origem.
- Missão e destino vêm do contexto validado da API; a zona é indicada automaticamente. Não há campo de gravidade medida, pressão ou temperatura corporal/exterior.
- Instruções MED-SONO/FC/HUMOR/CO2/TEMP adaptadas da biblioteca AKM-09 e protocolo AKM-06, com fontes NASA contextuais e limites explícitos. A escala de humor não é validada clinicamente.

## Confirmação e recuperação

Durante o POST os campos ficam bloqueados e o controlador aceita somente um envio. Só HTTP 201 com resposta válida e compatível com o payload produz confirmação, com ID, valor, alvo, origem, qualidade, momento medido e momento do cadastro separados.

HTTP 422 preserva os campos e associa os erros reconhecidos aos controles; rejeições gerais pedem revisão dos campos. HTTP 404 exige atualizar a missão/lista e selecionar novamente o tripulante. Falhas de carregamento mantêm o rascunho, informam contexto possivelmente desatualizado e bloqueiam o envio até recuperação. Um banco sem perfis permite registrar habitat após carregar o contexto.

Rede, timeout de 10 s, 5xx, status inesperado ou resposta 201 inválida/incompatível tornam o resultado **incerto**. Não existe reenvio automático. A tela conserva e bloqueia o rascunho, abre o histórico em nova aba e exige ação explícita de quem conferiu a ausência antes de liberar outro envio. A API não oferece chave de idempotência para medições: a conferência humana não garante deduplicação contra escritores concorrentes.

Depois de salvar, GET /api/dashboard é consultado novamente. Falha nessa consulta não desfaz nem oculta o recibo confirmado. POST /api/investigations/run e PATCH de follow-up nunca são disparados pelo formulário. O recibo orienta a consultar o dashboard/histórico e seguir a investigação separadamente.

**Edição:** campos são editáveis antes do envio. O contrato não possui PATCH/PUT de medições; não oferecemos alteração de registro salvo. Registrar outra medição é uma ação explícita após o recibo. Rascunhos são mantidos durante erros nesta tela, em memória; sair/recarregar perde o rascunho e o bloqueio local. Persistência offline/sincronização pertence à AKM-33.

## Reprodução e verificações

Com as dependências do README instaladas:

1. Inicie a API e o frontend; para perfis fictícios, use o seed conforme o README.
2. Abra #/registrar, escolha um tripulante, Sono, 5,2 h e uma data/hora com fuso. Confira a conversão UTC e salve.
3. Confira o ID e horários do recibo, consulte o histórico/dashboard e verifique que nenhuma investigação foi executada automaticamente.
4. Registre CO₂ ou temperatura com zona Habitat; experimente qualidade suspeita e origem simulada. Confira as origens no histórico.
5. Experimente valor vazio, sono fora de 0–24, FC zero, fuso inválido e calendário inválido. Nenhum registro deve ser enviado.
6. Interrompa a API ou use resposta inconclusiva durante o POST: confira o estado incerto e o histórico antes de liberar novo envio.

Comandos de validação:

- python scripts/check.py — Ruff, backend e TypeScript.
- npm --prefix frontend run test:registration — validação dos cinco payloads, calendário/fuso, 201/422/404, falhas incertas, single flight, timeout, respostas atrasadas, descarte após unmount e renderização React real. Inclui integração de payloads frontend com FastAPI/TestClient e SQLite temporário, consulta ao histórico/dashboard e contagem inalterada de investigações/follow-ups.
- npm --prefix frontend run test:dashboard
- npm --prefix frontend run test:history
- npm --prefix frontend run test:wireframe
- npm --prefix frontend run test:navigation
- npm --prefix frontend run build

A integração usa a .venv do repositório por padrão; PYTHON pode indicar outro executável com as dependências backend instaladas. Os bancos de teste são temporários; o banco de desenvolvimento não é alterado.

## Limites de validação

Labels, descrições, aria-invalid, foco de feedback e controles nativos foram implementados e o markup foi conferido nos testes. Isso não comprova acessibilidade completa. A validação visual, responsividade real, navegação por teclado e leitor de tela precisa ser concluída no navegador: o controle do computador/navegador falhou por timeout nesta sessão. Não há avaliação médica ou validação clínica.
