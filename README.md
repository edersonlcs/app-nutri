# EdeVida

Aplicacao pessoal para acompanhamento de nutricao, hidratacao, medidas corporais, exames, bioimpedancia e evolucao fisica.

## Estrutura

- `apps/api`: backend Node.js (Telegram + OpenAI + Supabase)
- `apps/web`: painel web (acompanhamento)
- `packages/shared`: itens compartilhados
- `infra/supabase`: migrations e scripts SQL
- `infra/deploy`: configuracoes de deploy VPS e migracao
- `doc-ia`: plano de atividades e registros

## Execucao local

```bash
cd apps/api
npm install
npm run dev
```

## Reset de dados de teste (antes de novo ciclo)

```bash
cd apps/api
npm run reset:test-data:dry
npm run reset:test-data
```

Guia tecnico completo: `doc-ia/guia-tecnico-edevida.md`.

Health check:

```bash
curl http://127.0.0.1:3000/health
```

Painel web:

```bash
curl http://127.0.0.1:3000/painel
```

## Funcionalidades implementadas (MVP atual)

- Webhook Telegram com seguranca por `TELEGRAM_WEBHOOK_SECRET`
- Registro de mensagens Telegram no Supabase (`telegram_updates`)
- Analise nutricional por texto com OpenAI
- Analise de foto de refeicao (visao) com OpenAI
- Analise de audio (transcricao + analise) com OpenAI
- Compatibilidade de audio Telegram para voz `.oga/.opus` (normalizacao automatica para transcricao)
- Classificacao de qualidade da refeicao em 5 niveis:
  - `otimo`
  - `bom`
  - `ainda pode, mas pouco`
  - `ruim`
  - `nunca coma`
- Registro automatico de hidratacao quando detectado na analise
- Edicao de lancamentos alimentares no web (grupo alimentar, resumo, alimentos e data/hora)
- Aba `IA` com perfis configuraveis por usuario (`Econômico`, `Recomendado`, `Clínico`) e ajuste fino de modelos
- API para perfil, metas, medidas corporais, bioimpedancia, exames, hidratacao e treinos
- Relatorios diarios/semanais/mensais com resumo agregado
- Painel web com abas, historicos e graficos em `/painel`
- Recomendacao inicial de treino (base para modulo personal trainer)
- Upload de anexos (bioimpedancia e exames) com compressao automatica de imagem
- Excluir anexo enviado (com limpeza do arquivo local) e editar metadados do exame
- Fallback automatico de modelos OpenAI quando um modelo nao estiver liberado na conta

## Endpoints principais

- `GET /health`
- `POST /webhook/telegram`
- `GET /api/telegram/webhook-info`
- `GET /api/users?auto_create=1`
- `POST /api/nutrition/analyze-text`
- `PATCH /api/nutrition/:id` (editar lancamento alimentar)
- `POST /api/hydration`
- `POST /api/measurements`
- `POST /api/bioimpedance`
- `POST /api/bioimpedance/upload` (anexo imagem + IA)
- `DELETE /api/bioimpedance/:id` (remover registro + tentar apagar arquivo do anexo)
- `POST /api/medical-exams`
- `POST /api/medical-exams/upload` (anexo PDF/imagem + IA)
- `PATCH /api/medical-exams/:id` (editar nome/tipo/data/observacoes do exame)
- `DELETE /api/medical-exams/:id` (remover exame + tentar apagar arquivo do anexo)
- `GET /api/ai/info` e `POST /api/ai/settings` (visualizar/alterar perfil de modelos IA)
- `POST /api/workouts`
- `POST /api/reports/generate`
- `GET /api/dashboard/overview`

## Uso Rapido (Telegram + Web)

1. Web:
   - Abra `https://SEU_DOMINIO/painel`
   - Registre perfil, medidas, hidracao e treinos
   - Use a aba `Anexos` para enviar bioimpedancia e exames (PDF/imagem)

2. Telegram:
   - Envie texto de refeicao, foto do prato ou audio
   - Comandos disponiveis:
     - `/start` ou `/help`
     - `/resumo`
     - `/nutricao`
     - `/corpo`
     - `/exames`
     - `/rascunho`
     - `/chat <pergunta>`
     - `/painel`

3. Anexos salvos:
   - Caminho local: `temp/uploads/`
   - URL web: `/uploads/<arquivo>`

## Deploy

- VPS: `infra/deploy/README.md`
- Hostinger (migracao futura): `infra/deploy/hostinger/README.md`
