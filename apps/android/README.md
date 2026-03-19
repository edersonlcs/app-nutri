# EdeVida Android

Diretorio reservado para o app Android (APK pessoal).

## Objetivo

Empacotar o frontend do EdeVida para Android, mantendo o backend atual.

## Escopo deste diretorio

- configuracao do Capacitor;
- projeto nativo Android gerado pelo Capacitor;
- scripts de build do APK.

## Documento de planejamento

Plano oficial: `doc-ia/plano-android-edevida.md`.

## Regras

1. Logica de negocio continua no backend (`apps/api`).
2. Ajustes de interface compartilhada continuam em `apps/web`.
3. O que for exclusivo do Android deve ficar aqui.
