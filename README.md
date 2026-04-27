# Borbulhas de Cacau — Admin

Painel de administração de produtos. Usa o Google Sheets como banco de dados.  
O script `sync-products.js` lê a planilha e regera os arquivos JS do site.

## Como funciona

```
Google Sheets  →  sync-products.js  →  js/data-*.js  →  Site Firebase
```

1. Você edita os produtos diretamente na planilha do Google Sheets
2. Clica em **Sincronizar** no painel admin (ou o GitHub Actions roda automaticamente à meia-dia)
3. O script lê a planilha, regera os arquivos `js/data-vinhos.js`, `js/data-chocolates.js` e `js/data-presentes.js` no repo `borbulhas-web`
4. O Firebase Hosting publica automaticamente via CI

---

## Estrutura da Planilha

A planilha deve ser **pública** (Arquivo → Compartilhar → Qualquer pessoa com o link pode **visualizar**).

Crie uma planilha com **3 abas** com os nomes exatos:

### Aba `vinhos`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | texto | Slug único (ex: `espumante-moscatel-jolimont`) |
| `ordem` | número | Ordem de exibição |
| `nome` | texto | Nome do produto |
| `subcategoria` | texto | Ex: `Espumantes`, `Tintos`, `Brancos` |
| `preco` | número | Preço em R$ (ex: `119.00`) |
| `imagem` | texto | Caminho da imagem (ex: `img/jolimont/moscatel.png`) |
| `uva` | texto | Variedade(s) de uva |
| `safra` | texto | Ano da safra (ex: `2023`) |
| `teor` | texto | Teor alcoólico (ex: `7,5%`) |
| `volume` | texto | Volume (ex: `750ml`) |
| `regiao` | texto | Região produtora (ex: `Serra Gaúcha`) |
| `temperatura` | texto | Temperatura de serviço (ex: `6–8°C`) |
| `guarda` | texto | Potencial de guarda (ex: `até 8 anos`) — deixe em branco se não aplicável |
| `descricao` | texto | Descrição curta |
| `notas` | texto | Notas de degustação |
| `harmonizacao` | texto | Harmonizações sugeridas |
| `destaque` | boolean | `true` ou vazio |

### Aba `chocolates`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | texto | Slug único |
| `ordem` | número | Ordem de exibição |
| `nome` | texto | Nome do produto |
| `subcategoria` | texto | Ex: `Barras`, `Trufas`, `Alfajores` |
| `preco` | número | Preço em R$ |
| `imagem` | texto | Caminho da imagem |
| `peso` | texto | Peso (ex: `100g`) |
| `cacau` | texto | % de cacau (ex: `73%`) — vazio se não aplicável |
| `origem` | texto | Ex: `Gramado/RS` |
| `alcool` | boolean | `true` se contém álcool |
| `alergenos` | texto | Lista separada por vírgula: `leite, soja, nozes` |
| `descricao` | texto | Descrição |
| `notas` | texto | Notas de sabor |
| `harmonizacao` | texto | Harmonizações |
| `destaque` | boolean | `true` ou vazio |

### Aba `presentes`

Mesmas colunas que `chocolates`.

---

## Configurar o Sync Automático

### 1. Adicionar o ID da planilha como Secret no GitHub

No repositório `borbulhas-web`:

1. Vá em **Settings → Secrets and variables → Actions**
2. Clique em **New repository secret**
3. Nome: `GOOGLE_SHEET_ID`
4. Valor: o ID da planilha (parte da URL: `https://docs.google.com/spreadsheets/d/**ID**/edit`)

### 2. Rodar o sync manualmente

```bash
SHEET_ID=<id_da_planilha> node scripts/sync-products.js
```

### 3. Sync automático via GitHub Actions

O workflow `.github/workflows/sync-products.yml` no repo `borbulhas-web`:
- Roda **automaticamente todo dia ao meio-dia** (UTC)
- Pode ser disparado manualmente em **Actions → Sincronizar Produtos → Run workflow**
- Pode ser disparado pelo **botão Sincronizar** no painel admin (requer GitHub Token)

---

## Painel Admin

Abra `index.html` localmente ou hospede em qualquer servidor estático.

**Configure:**
- **ID da Planilha**: o ID do Google Sheets
- **GitHub Token**: token com scope `workflow` para disparar o sync pelo painel
  - Gerar em: https://github.com/settings/tokens/new?scopes=workflow

As configurações são salvas no `localStorage` do browser.
