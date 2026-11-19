# Módulo: Risk Zones (Agrupamento e Cálculo de Zonas de Risco)

## 1. Escopo e Requisitos Associados
- **RF06**: Exibição de polígonos e marcadores de zonas de risco no mapa.
- **RN01 / RN02**: Classificação e pontuação de risco acumulada com níveis (moderado, alto, extremo).
- **RN03**: Agrupamento espacial de incidentes em raio de até 20 metros.
- **RN04 / RN05**: Penalidade de custo em vias e amortização temporal (6 meses relatos / 12 meses SSP).

## 2. Estrutura Direta de Arquivos
- `router.py`: Rotas `/api/v1/risk-zones/*` e esquemas GeoJSON.
- `service.py`: Fórmulas matemáticas de decaimento, severidade e lógica de agregação espacial.
- `models.py`: Modelos SQLAlchemy com suporte a geometrias PostGIS.

## 3. Base pública — verificação em 09/11/2026

Fonte candidata: [Consultas SSP-SP](https://www.ssp.sp.gov.br/estatistica/consultas),
conjunto [Celulares subtraídos — 2026](https://www.ssp.sp.gov.br/assets/estatistica/transparencia/baseDados/celularesSub/CelularesSubtraidos_2026.xlsx).
Amostra inspecionada: abas `METODOLOGIA`, `DICIONARIO DE DADOS` e `CELULAR_2026`.
O dicionário define `LATITUDE`/`LONGITUDE` como local da ocorrência, mas não
explicita datum ou precisão: compatibilidade com WGS84 e agrupamento de 20 m
permanece pendente. Nas primeiras 10.000 linhas, 8.294 pares estavam em limites
válidos e não zerados; 1.494 ausentes e 212 inválidos. Isso não comprova precisão
nem representa a cobertura completa da base.

**Regras da importação implementada (CSV normalizado):**

- Começar por `RUBRICA = Furto (art. 155)` → categoria `Furto`; demais naturezas
  ficam fora desse recorte, sem converter roubo em furto. Não há cobertura SSP
  validada para todas as categorias do app.
- Filtrar pelo município do fato (`CIDADE`), não pela delegacia de registro.
  Excluir coordenadas ausentes, zeradas, inválidas, fora do município ou com
  indicação de localização protegida; não geocodificar dados suprimidos.
- Deduplicar por `NOME_DELEGACIA + ANO_BO + NUM_BO`, conforme a metodologia;
  tratar `VERSAO` antes de selecionar natureza/localização. Divergências na
  versão mais recente exigem rejeição para revisão, sem escolher linha arbitrária.
- Importar arquivo local por comando administrativo, sem HTTP durante consultas
  do mapa. Usar CSV UTF-8 normalizado da aba de ocorrências, evitando nova
  dependência XLSX; validar cabeçalhos e conversão de datas/coordenadas.
- Guardar chave de origem, versão, URL, período, hash do arquivo e data de carga;
  reimportação atualiza sem duplicar. Relatar totais aceitos/rejeitados por motivo,
  sem registrar conteúdo pessoal. Não importar narrativa, endereço ou objetos;
  a descrição pública pode ser null.

A metodologia alerta que linhas não equivalem a ocorrências e que esta base
exploratória não constitui estatística oficial. A [entrada consultada no catálogo
estadual](https://dadosabertos.sp.gov.br/dataset/dados-seguranca-publica) declara
CC BY 4.0, mas não vincula esse XLSX: confirmar termos aplicáveis ao arquivo e
manter atribuição SSP-SP antes de publicar. Frequência de republicação e política
para registros removidos/retificados também precisam de validação; não há API
ou atualização automática garantida nesta proposta. Dados brutos não versionados.


## 4. Executar a carga

Aplicar `alembic upgrade head` no backend. Converter a aba `CELULAR_2026` para
CSV UTF-8 separado por vírgulas, mantendo os nomes de colunas SSP; normalizar
`DATA_OCORRENCIA_BO` para `YYYY-MM-DD`, coordenadas para decimal com ponto e
`VERSAO` para inteiro positivo. Não remover linhas/versões antes da importação.
Fornecer limite municipal GeoJSON Polygon/MultiPolygon em WGS84 (Geometry ou
Feature); a procedência e o sistema de referência desse arquivo são responsabilidade
de quem prepara a carga.

```bash
DEBUG=false python -m src.modules.risk_zones.import_ssp ocorrencias.csv \
  --boundary municipio.geojson --period 2026 \
  --source-url https://www.ssp.sp.gov.br/assets/estatistica/transparencia/baseDados/celularesSub/CelularesSubtraidos_2026.xlsx
```

Migração `0007_ssp_safety_records`: registros separados, categoria fixa `Furto`,
índice espacial e chave de origem única derivada por SHA-256. A carga é atômica,
serializada e imprime somente contagens. `accepted` conta candidatos válidos do
arquivo; `ignored_older` conta candidatos que não substituíram versão mais nova.
Versão inválida ou chave ausente cancela toda a carga. Versão recente rejeitada
desativa o ponto e apaga localização/data; boletins ausentes do arquivo permanecem
inalterados. Mesma versão reapresentada substitui o conteúdo anterior; por isso,
usar arquivos completos e revisados da fonte. O hash identifica o CSV normalizado,
não o XLSX original. A importação não publica nem agrupa; não há carga automática.


## 5. Agrupamento RN03

`RiskZoneService.group()` combina relatos visíveis e registros SSP ativos em
componentes conexos, independentemente da categoria. Vizinhança calculada por
`ST_DWithin(geography, geography, 20 m)` no elipsoide, com tolerância numérica de
0,1 micrômetro. A–B e B–C próximos formam um grupo mesmo se A–C exceder 20 m.
Um membro gera Point; múltiplos geram união dos buffers métricos de 10 m,
Polygon/MultiPolygon. O marcador fica dentro da geometria.

Consulta única fornece membros, vizinhos e buffers no mesmo snapshot, antes de
qualquer filtro de mapa. Não persiste zonas: alterações/ocultações/desativações
refletem na próxima consulta. UUID v5 deriva da composição (`origem + UUID`);
é estável enquanto os membros não mudarem, inclusive entre diferentes recortes.
Não representa identidade permanente após divisão/fusão. Retorno preserva todas
as categorias/origens e apenas campos públicos dos incidentes.

Sem pontuação, severidade ou aplicação de validade temporal nesta etapa. A migração
`0008_risk_geography_indexes` adiciona índices GiST geográficos parciais para relatos
visíveis e registros SSP ativos. A busca de vizinhos usa esses índices, mas a
consulta ainda processa todos os membros; grupos densos podem gerar custo quadrático.


## 6. Consultas públicas

- `GET /api/v1/risk-zones?bbox=-46.64,-23.56,-46.62,-23.54`: GeoJSON, categorias,
  origens, marcador e quantidade de incidentes; limite 25 km²/500 zonas.
- `GET /api/v1/risk-zones/{uuid_v5}/incidents?page=1&page_size=20`: composição
  paginada, com `report_id` para abrir detalhes/comentários do app; SSP usa null.

Contrato e erros na seção 11 de `docs/api_contracts.md`. Routers apenas validam
HTTP e delegam ao serviço. As consultas não exigem localização da usuária nem
armazenam navegação. Desempenho com carga real, licença/precisão SSP e cálculo de
pontuação/validade temporal permanecem pendentes; a API não classifica severidade.


## 7. Revisão final — 10/11/2026

Consulta métrica com 2.500 pontos SSP sintéticos espaçados: 10,58 s antes e
0,27 s com índices, em execução local única (sem garantia de latência em produção).
Plano de execução confirmou uso de `ix_ssp_active_geography`. Medir com volume
real e agrupamentos densos antes da implantação.

Recorte backend funcional para integração: GeoJSON, categorias, composição pública,
importação de furtos SSP e agrupamento RN03. A issue integrada ainda depende do
frontend (marcadores/cores/clique), carga real revisada e validação de licença e
precisão SSP. Não interpretar ausência de pontos como área segura; não há ranking
ou classificação de severidade sem definir RN01/RN02/RN05.
