# APP-NUTRI - Plano de Atividades (Passo a Passo)

## Como vamos trabalhar

1. Vamos executar **1 atividade por vez**.
2. Voce faz a atividade no seu ritmo e tira duvidas comigo.
3. So avancamos para a proxima atividade quando voce escrever: **"pode ir para a proxima"**.
4. Ao final de cada atividade:
   - eu valido com voce o que foi feito;
   - eu te mostro a mensagem de commit sugerida;
   - somente com sua autorizacao eu faco commit e push.

---

## Visao Geral da Solucao

Teremos 3 frentes principais:

1. **Bot Telegram (entrada principal)**
   - Recebe texto, audio e foto.
   - Envia para API Node.js.
   - API registra no Supabase e usa OpenAI para analise nutricional.
   - Permite enviar exames medicos e resultados de bioimpedancia para analise de evolucao.

2. **API Node.js (backend central)**
   - Regras de negocio (nutricao, registros, relatorios).
   - Integracao com Supabase.
   - Integracao com OpenAI.
   - Persona fixa da IA (nutricionista pessoal) com comportamento e limites definidos.
   - Endpoints para o painel web.

3. **Painel Web (acompanhamento)**
   - Dashboard simples com historico de refeicoes, peso e indicadores.
   - Area para relatorios (dia, semana, mes).

Arquitetura pensada para:
- rodar agora na sua VPS;
- migrar depois para hospedagem Node.js da Hostinger com minimo ajuste.

---

## Estrutura de Pastas (alvo)

```txt
app-nutri/
  doc-ia/
    atividades-app-nutri.md
  temp/
  apps/
    api/                 # Node.js + Telegram webhook + regras
    web/                 # Painel web
  packages/
    shared/              # tipos, validacoes, utilitarios
  infra/
    supabase/            # SQL migrations, seeds e politicas
    deploy/              # scripts de VPS/Hostinger
  .env.example
  README.md
```

Observacao: podemos simplificar ou expandir conforme evoluirmos.

---

## Backlog de Atividades

### Atividade 1 - Preparacao de contas, chaves e ambiente local (**iniciar por aqui**)
Objetivo: deixar tudo pronto para comecar a codar sem travas.

### Atividade 2 - Inicializacao do projeto Node.js e estrutura de pastas
Objetivo: criar base da API com organizacao limpa e escalavel.

### Atividade 3 - Criar projeto Supabase e banco inicial
Objetivo: modelar tabelas principais (perfil, refeicoes, registros corporais, exames medicos, bioimpedancia, logs IA).

### Atividade 4 - Configurar bot Telegram e webhook
Objetivo: receber mensagens de texto no backend.

### Atividade 5 - Integrar OpenAI (texto) para analise nutricional
Objetivo: interpretar o que voce comeu e sugerir orientacoes.

### Atividade 6 - Definir persona da IA nutricionista (OpenAI)
Objetivo: padronizar tom, regras, limites de seguranca e formato das respostas.

### Atividade 7 - Integrar foto de refeicao (visao) e registrar no banco
Objetivo: analisar imagem e transformar em registro alimentar.

### Atividade 8 - Integrar audio (transcricao) e registrar no banco
Objetivo: converter audio em texto, analisar e registrar.

### Atividade 9 - Registrar e analisar exames medicos e bioimpedancia
Objetivo: guardar historico periodico, comparar resultados e gerar analise de melhoria.

### Atividade 10 - Criar regras de relatorio diario/semanal
Objetivo: ter resumo automatico de alimentacao e progresso.

### Atividade 11 - Criar painel web inicial
Objetivo: visualizar historico, metricas e relatorios.

### Atividade 12 - Deploy na VPS (producao atual)
Objetivo: deixar rodando com seguranca, logs e reinicio automatico.

### Atividade 13 - Preparar migracao para Hostinger (Node hosting)
Objetivo: reduzir custo depois, sem reescrever projeto.

### Atividade 14 - Preparar base para modulo futuro de atividade fisica
Objetivo: deixar estrutura pronta para personal trainer + impacto na dieta.

---

## ATIVIDADE 1 (Detalhada) - Preparacao de contas, chaves e ambiente

## Resultado esperado da Atividade 1

Ao final desta atividade voce tera:

1. Projeto Supabase criado.
2. Bot do Telegram criado com token ativo.
3. Chave da OpenAI criada.
4. Arquivo `.env` local preenchido (sem subir segredo no GitHub).
5. Documento inicial da persona da IA criado.
6. Checklist de validacao concluido.

---

## Passo 1 - Supabase (console web)

1. Acesse: `https://supabase.com/dashboard`
2. Clique em **New project**.
3. Defina:
   - Organization: a sua.
   - Name: `app-nutri` (ou `app-nutri-prod`).
   - Database Password: crie uma senha forte e guarde.
   - Region: escolha a mais proxima do Brasil (normalmente Sao Paulo).
4. Aguarde o provisionamento (pode levar alguns minutos).
5. No projeto criado, copie e guarde:
   - `Project URL`
   - `anon public key`
   - `service_role key` (segredo: nao expor no frontend)

---

## Passo 2 - Telegram bot

1. No Telegram, abra o chat **@BotFather**.
2. Execute `/newbot`.
3. Defina:
   - nome do bot (ex: Nutri Ederson).
   - username terminado com `bot` (ex: `ederson_nutri_bot`).
4. O BotFather retornara o **BOT TOKEN**. Guarde com cuidado.
5. (Opcional agora) Defina foto e descricao com:
   - `/setuserpic`
   - `/setdescription`

---

## Passo 3 - OpenAI API key

1. Acesse `https://platform.openai.com/`
2. Entre no menu de API keys.
3. Clique em criar nova chave.
4. Salve a chave em local seguro (ela aparece uma vez).
5. Se possivel, configure limite de uso para controle de custo.

---

## Passo 4 - Preparar variaveis de ambiente no projeto

Quando formos iniciar a Atividade 2, vamos criar estes arquivos:

- `.env` (local, com segredos reais)
- `.env.example` (sem segredos, modelo para referencia)

Variaveis previstas:

```env
NODE_ENV=development
PORT=3000

TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=

OPENAI_API_KEY=
OPENAI_MODEL_TEXT=gpt-4.1-mini
OPENAI_MODEL_VISION=gpt-4.1-mini
OPENAI_MODEL_TRANSCRIBE=gpt-4o-mini-transcribe

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

APP_TIMEZONE=America/Sao_Paulo
```

Observacoes:
- Os nomes dos modelos podem ser ajustados depois por custo/qualidade.
- A `SUPABASE_SERVICE_ROLE_KEY` fica apenas no backend.

---

## Passo 5 - Definir persona inicial da IA (documento)

Criar um arquivo de referencia para guiar todas as respostas da IA, com:

1. Papel: nutricionista pessoal focada em acompanhamento diario.
2. Tom: claro, direto, acolhedor e sem julgamentos.
3. Regras:
   - sempre considerar seus dados historicos (peso, exames, bioimpedancia, rotina);
   - evitar afirmar diagnostico medico;
   - quando detectar sinal de risco, orientar procura de profissional de saude;
   - responder com orientacao pratica e proximo passo objetivo.
4. Formato padrao de resposta:
   - analise curta;
   - impacto esperado;
   - recomendacao de acao.
5. Restricoes:
   - nao inventar valores nutricionais sem sinalizar estimativa;
   - nao substituir conduta medica.

---

## Passo 6 - Checklist de validacao da Atividade 1

Marque cada item quando concluir:

- [ ] Tenho projeto Supabase criado.
- [ ] Guardei URL e chaves do Supabase.
- [ ] Tenho bot Telegram criado e token salvo.
- [ ] Tenho chave da OpenAI criada.
- [ ] Tenho definido como a persona da IA deve responder.
- [ ] Entendi quais segredos nunca vao para GitHub.

Se qualquer item nao estiver ok, ficamos nesta atividade ate resolver.

---

## Regras de seguranca (sempre)

1. Nunca commitar:
   - tokens
   - senhas
   - `.env`
2. Usar sempre `.env.example` para documentar variaveis.
3. Rotacionar chave imediatamente se vazar.

---

## Modelo de commit (quando atividade for concluida)

```txt
docs: cria plano inicial de atividades do app-nutri
```

Descricao sugerida do commit:

```txt
- adiciona roteiro por etapas em doc-ia
- detalha atividade 1 (Supabase, Telegram, OpenAI e ambiente)
- inclui exames medicos, bioimpedancia e persona da IA no planejamento
- define fluxo de execucao uma atividade por vez
```
