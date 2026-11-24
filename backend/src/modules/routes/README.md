# Rotas para pedestres (RF15)

`POST /api/v1/routes/calculate`: origem, destino e até 3 paradas ordenadas.
Retorna até 3 candidatas ORS, geometria, instruções, tempo e exposição aos riscos
mapeados; sinaliza desvio de tempo superior a 30% (RN07). Sem histórico no servidor.

`clients.py` integra ORS/Overpass; `schemas.py` valida os formatos; `service.py`
compõe candidatas e compara exposição; `router.py` injeta dependências e expõe HTTP.
O módulo `risk_zones` calcula elegibilidade, pesos e correspondência espacial.

Contrato, configurações, limites e fórmula em [api_contracts.md](../../../../docs/api_contracts.md#16-rotas-para-pedestres--rf15).
RN04 é atendida parcialmente: seleção entre candidatas, sem modificar pesos no motor.
Risco indisponível ou ausência de registros nunca significa garantia de segurança.

O aplicativo usa `geometry`, `legs[].steps` e `comparison` para apresentar a escolha
e iniciar a navegação; `way_points` indexa a geometria completa. GPS, cache offline
e notificação persistente (RNF04) devem ser implementados no cliente. Não há endpoint
de início nem rastreamento. Validação com chave ORS e dados reais permanece necessária.
