# ProtegEla

Este projeto é produto das disciplinas MAC0332 - Engenharia de Software e MAC0413 - Tópicos Avançados em Programação Orientada a Objetos.

## Descrição do Problema

O problema escolhido é a insegurança vivida pelas mulheres em espaços públicos, devido a crimes de assédio, abuso sexual, assaltos, furtos e violência contra a mulher. Essa insegurança restringe a sua autonomia, pois muitas vezes é difícil saber que ruas devem ser evitadas, que ruas têm maior histórico de furtos, etc. Assim, o ProtegEla propõe a visualização fácil de áreas perigosas na cidade de São Paulo, principalmente pensando nas mulheres, e também possibilita o compartilhamento de relatos e avisos sobre certos pontos.

## API de Dados Abertos

A solução tecnológica proposta integrará de forma efetiva os dados abertos do ecossistema global do OpenStreetMap (OSM) por meio de sua interface de dados brutos, a Overpass API, de forma combinada à API de mobilidade do OpenRouteService.

Para que a API não seja apenas visual na geração do mapa, também usaremos a Overpass API para que, a partir da informação da localização da usuária, o aplicativo consiga consultar as delegacias e estruturas estratégicas de segurança para a usuária, caso ela precise de ajuda ou tenha o conhecimento de destaque sobre esses locais sem precisar de uma busca específica por esses estabelecimentos.

Como a proposta deve oferecer rotas de navegação inteligentes que priorizem o bem-estar do usuário, o sistema integrará esses dados de localização com o motor do OpenRouteService, utilizando o recurso nativo de restrição geométrica da API. O aplicativo vai enviar as coordenadas das zonas de risco, mapeadas de forma colaborativa pelas próprias usuárias em um fórum, para que o algoritmo calcule caminhos alternativos. Essa abordagem permite criar níveis configuráveis de desvio, evitando que a usuária passe por ruas desertas ou com alto índice de incidentes, sem gerar voltas desnecessárias quando o nível de alerta do local for moderado.

