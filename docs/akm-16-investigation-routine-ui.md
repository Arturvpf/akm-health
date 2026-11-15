# AKM-16 · Interface de investigação e rotina

[Cartão AKM-16](https://app.notion.com/p/4189432b2222817a829fd665073b84ee) · [Arquitetura](https://app.notion.com/p/4189432b2222816494fdd66f32e11ec4) · [Fluxo AKM-04](akm-04-investigation-flow.md)

A tela **Investigação** oferece os escopos coletivo e individual. A execução é explícita e exibe o resultado experimental com seu ID, horário UTC, escopo e versão. Uma resposta `reused: true` conserva o ID, o horário e a referência da checagem original. A tela recupera o último número aberto nesta sessão por GET, aceita a recuperação por número e oferece o acesso à investigação que originou uma checagem. O resultado salvo descreve a decisão original. A agenda lê separadamente o estado atual e conserva a ordem de prioridade do servidor.

Achados, cobertura, evidências, hipóteses não confirmadas, incerteza, referências NASA HRP, decisão de checagem e revisão humana aparecem em seções próprias. A cobertura ausente sinaliza uma lacuna do registro. A cobertura vazia sinaliza dados insuficientes para o escopo. O encaminhamento usa a instrução do servidor e o contato é manual. As referências acompanham a análise como contexto de pesquisa. [Explicação AKM-26](akm-26-investigation-explanation.md)

Para concluir uma checagem, selecione uma medição persistida do mesmo indicador, alvo e zona. A lista exige qualidade válida e cadastro posterior à solicitação. Quando o cabeçalho HTTP `Date` está disponível, usa o segundo informado pela API para filtrar datas futuras, com um segundo de tolerância para o cache do cabeçalho. O servidor valida o horário exato no vínculo e retorna a data de conclusão. Uma leitura antiga pode servir se tiver sido cadastrada após a solicitação, conforme o contrato. A reanálise é uma ação posterior e explícita. A interface consulta o dashboard ao abrir, após executar e após tentar vincular, para atualizar a indicação de medições aguardando análise na missão. [Persistência AKM-20](akm-20-investigation-persistence.md) · [Agenda AKM-25](akm-25-adaptive-routine.md)

Sem observações, o motor pode devolver dados insuficientes e a tela explica a lacuna. Durante o carregamento e em falhas, o último resultado confirmado conserva sua classificação e horário. A interface permite corrigir o número ou o tripulante, repetir a execução ou a recuperação e atualizar agenda e medições. Uma resposta incerta ao vínculo dispara leitura da agenda antes de outra tentativa. Se a conclusão existir, a tela mostra a medição que o servidor confirmou.

## Reproduzir no navegador

Prepare as dependências conforme o [README](../README.md). Em PowerShell, na raiz, escolha um SQLite novo para a demonstração. O exemplo abaixo desloca as datas da fixture sintética para perto do relógio atual e habilita a política demonstrativa da agenda.

```powershell
$env:AKM_DB_PATH = Join-Path ([System.IO.Path]::GetTempPath()) ("akm16-" + [guid]::NewGuid() + ".db")
$env:AKM_INVESTIGATION_CONFIG = (Resolve-Path backend/app/routine_demo_config.json).Path
$env:PYTHONPATH = (Resolve-Path backend).Path
@'
from datetime import datetime, timedelta, timezone
from app import seed
from app.db import make_engine

original = seed.observations
shift = datetime.now(timezone.utc) - timedelta(hours=1) - seed.NIGHT_2
seed.observations = lambda: [
    item.model_copy(update={"measured_at": item.measured_at + shift})
    for item in original()
]
engine = make_engine()
seed.seed(engine)
engine.dispose()
'@ | python -
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

Em outro terminal, execute `npm --prefix frontend run dev` e abra `http://127.0.0.1:5173/#/investigacao`.

1. Execute a investigação coletiva. Confira o achado experimental de sono, A1 a A4 na cobertura, a hipótese ambiental em aberto e a checagem de CO₂ do habitat com justificativa. Execute novamente e confira a mensagem de reutilização, o mesmo ID e a ausência de duplicatas.
2. Abra a checagem de CO₂ na agenda. A conclusão só fica disponível com uma medição elegível. Registre uma nova leitura de CO₂ do habitat e retorne à agenda. Em uma versão do shell que ainda exibe a prévia de Registrar, use o comando abaixo para gravar a leitura.
3. Atualize as medições, selecione o número retornado e vincule. Confira a saída da checagem da lista pendente, o ID da medição e o horário de conclusão. Outras checagens permanecem na agenda. Reanalise o mesmo escopo e confira um novo ID. O resultado depende da nova janela e das entradas do motor.
4. Escolha o escopo individual e Lyra (A4). Execute e confira o escopo. Recupere o resultado coletivo pelo número ou pela agenda e confira o horário original.
5. Para o cenário vazio, abra a API com outro banco, sem carregar a fixture. Para verificar as retentativas, interrompa a conexão antes de reanalisar e reconecte para repetir. O resultado confirmado deve continuar visível durante a falha.

```powershell
$body = @{
  kind = 'co2_ppm'
  value = 850
  unit = 'ppm'
  measured_at = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fff'Z'")
  source = 'synthetic'
} | ConvertTo-Json
Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/measurements' -Method Post -ContentType 'application/json' -Body $body
```

O [wireframe AKM-10](../frontend/public/akm-10-wireframe.html) continua disponível para cenários em memória. O [roteiro AKM-11](akm-11-accessible-design-system.md) descreve os estados e componentes de acessibilidade da demonstração.

O teste `node --test frontend/scripts/test-investigation-api.cjs` cobre relógio do navegador atrasado, a precisão de segundos do horário HTTP e cabeçalho ausente.
