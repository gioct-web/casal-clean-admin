# Preparação para APK Android

O projeto foi preparado para ser aberto em um contêiner Android pelo Capacitor, preservando o backend web já publicado. Como a calculadora depende de autenticação, banco de dados, catálogo e tRPC, a versão Android deve apontar para a URL HTTPS publicada do sistema; por isso, o aplicativo não contém credenciais, banco local ou endereço de desenvolvimento embutidos.

## Gerar uma versão Android

Execute os comandos abaixo em uma máquina com Android Studio e SDK Android instalados. Informe a URL HTTPS publicada atual no lugar de `https://SEU-DOMINIO`.

```bash
pnpm install
CAPACITOR_SERVER_URL=https://SEU-DOMINIO pnpm exec cap add android
CAPACITOR_SERVER_URL=https://SEU-DOMINIO pnpm run android:sync
pnpm run android:open
```

>No Android Studio, use **Build > Generate Signed Bundle / APK** para produzir um APK assinado. O identificador configurado é `com.casalclean.orcamentos`.

## Comportamento no aplicativo

Os controles principais possuem alvos de toque de no mínimo 44 px em dispositivos de toque. O HTML declara suporte para WebView e área segura de tela. Em Android WebView ou Capacitor, o envio usa o link oficial `wa.me` na própria visualização, permitindo que o Android encaminhe o deep link para o WhatsApp disponível no aparelho. Nos navegadores comuns, o comportamento continua abrindo uma nova aba de forma segura.

## Verificação antes de distribuir

Confirme login, criação de orçamento, seleção conjunta de serviços, agendamento comum, opção **A definir com o cliente**, histórico e envio ao WhatsApp em um dispositivo real. A URL configurada precisa utilizar HTTPS válido para que o WebView Android carregue o sistema de forma segura.
