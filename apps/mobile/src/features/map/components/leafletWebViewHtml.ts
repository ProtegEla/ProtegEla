import type { Coordinates } from "../types";
import {
  POLICE_STATION_SVG,
  SELECTED_LOCATION_SVG,
  getReportMarkerStyle,
} from "../../reports/mapMarkerIcons";

const CATEGORIES = [
  "Furto",
  "Roubo",
  "Violência",
  "Assédio",
  "Má iluminação",
  "Outro",
];

function buildCategoryStylesMap(): Record<string, { color: string; svg: string }> {
  const map: Record<string, { color: string; svg: string }> = {};
  for (const cat of CATEGORIES) {
    map[cat] = getReportMarkerStyle(cat);
  }
  return map;
}

/**
 * Gera o HTML autocontido do Leaflet para renderização em WebView (Android/iOS).
 */
export function buildLeafletWebViewHtml(
  initialCenter: Coordinates,
  initialZoom: number,
  tileProviders: Record<string, { url: string; attribution: string }>,
): string {
  const categoryStylesJson = JSON.stringify(buildCategoryStylesMap());
  const selectedSvgJson = JSON.stringify(SELECTED_LOCATION_SVG);
  const policeSvgJson = JSON.stringify(POLICE_STATION_SVG);
  const providersJson = JSON.stringify(tileProviders);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #F8FAFC;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    (function () {
      var CATEGORY_STYLES = ${categoryStylesJson};
      var SELECTED_SVG = ${selectedSvgJson};
      var POLICE_SVG = ${policeSvgJson};
      var TILE_PROVIDERS = ${providersJson};

      var map = L.map("map", {
        center: [${initialCenter.latitude}, ${initialCenter.longitude}],
        zoom: ${initialZoom},
        zoomControl: false,
        attributionControl: false
      });

      var markersLayer = L.layerGroup().addTo(map);
      var zonesLayer = L.layerGroup().addTo(map);
      var routesLayer = L.layerGroup().addTo(map);
      var routePane = map.createPane("report-routes");
      routePane.style.zIndex = "450";

      var tileLayer = null;
      var currentStyle = null;
      var isInteractive = true;
      var fittedRouteKey = null;

      function postToApp(type, payload) {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, payload: payload }));
        }
      }

      function createPopupHtml(title, description) {
        var wrap = document.createElement("div");
        wrap.style.cssText = "font-family:system-ui,sans-serif;min-width:160px;padding:4px;";
        var strong = document.createElement("strong");
        strong.style.color = "#593582";
        strong.textContent = title || "";
        wrap.appendChild(strong);
        if (description) {
          var p = document.createElement("p");
          p.style.cssText = "font-size:12px;line-height:18px;margin:6px 0 0;color:#475569;";
          p.textContent = description;
          wrap.appendChild(p);
        }
        return wrap;
      }

      function getReportStyle(category) {
        if (CATEGORY_STYLES[category]) return CATEGORY_STYLES[category];
        var norm = (category || "").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").trim().toLowerCase();
        if (norm === "furto") return CATEGORY_STYLES["Furto"];
        if (norm === "roubo") return CATEGORY_STYLES["Roubo"];
        if (norm === "violencia") return CATEGORY_STYLES["Violência"];
        if (norm === "assedio") return CATEGORY_STYLES["Assédio"];
        if (norm === "ma iluminacao") return CATEGORY_STYLES["Má iluminação"];
        return CATEGORY_STYLES["Outro"];
      }

      function getReportBorderColor(report) {
        if (report && report.source === "ssp") return "#16A34A";
        if (report && (report.confirmations_count || 0) >= 3) return "#2DD4BF";
        return "#FFFFFF";
      }

      function createReportIcon(category, borderColor) {
        var style = getReportStyle(category);
        var el = document.createElement("div");
        el.style.cssText = "width:30px;height:30px;box-sizing:border-box;border:2.5px solid " + (borderColor || "#FFFFFF") + ";border-radius:50%;background:" + style.color + ";display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);transform:scale(var(--protegela-marker-scale,0.85));transition:transform 0.15s ease;";
        el.innerHTML = style.svg;
        return L.divIcon({ className: "", html: el, iconSize: [30, 30], iconAnchor: [15, 15] });
      }

      function createSelectedIcon() {
        var el = document.createElement("div");
        el.style.cssText = "width:34px;height:38px;filter:drop-shadow(0 3px 4px rgba(0,0,0,0.3));display:flex;justify-content:center;align-items:center;";
        el.innerHTML = SELECTED_SVG;
        return L.divIcon({ className: "", html: el, iconSize: [34, 38], iconAnchor: [17, 36] });
      }

      function createPoliceIcon() {
        var el = document.createElement("div");
        el.style.cssText = "width:32px;height:32px;box-sizing:border-box;border:2px solid white;border-radius:50%;background:#6D4DA8;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);transform:scale(var(--protegela-marker-scale,1));transition:transform 0.15s ease;";
        el.innerHTML = POLICE_SVG;
        return L.divIcon({ className: "", html: el, iconSize: [32, 32], iconAnchor: [16, 16] });
      }

      function updateMarkerScale() {
        var z = map.getZoom();
        var scale = z >= 16 ? 0.85 : z >= 14 ? 0.62 : 0.42;
        var mapEl = document.getElementById("map");
        if (mapEl) mapEl.style.setProperty("--protegela-marker-scale", String(scale));
      }
      updateMarkerScale();
      map.on("zoomend", updateMarkerScale);

      map.on("click", function (ev) {
        if (!isInteractive) return;
        var pos = ev.latlng.wrap();
        postToApp("mapClick", { latitude: pos.lat, longitude: pos.lng });
      });

      window.flyToView = function (center, zoom) {
        if (!center || typeof center.latitude !== "number" || typeof center.longitude !== "number") return;
        try {
          map.invalidateSize(false);
          map.flyTo([center.latitude, center.longitude], zoom || 17, { duration: 0.8 });
        } catch (e) {}
      };

      window.updateMapState = function (state) {
        if (!state) return;

        isInteractive = state.interactive !== false;
        ["dragging", "touchZoom", "doubleClickZoom", "scrollWheelZoom", "boxZoom", "keyboard"].forEach(function (name) {
          if (!map[name]) return;
          if (isInteractive) map[name].enable();
          else map[name].disable();
        });

        var nextStyle = state.mapStyle || "clean";
        if (nextStyle !== currentStyle && TILE_PROVIDERS[nextStyle]) {
          if (tileLayer) tileLayer.remove();
          tileLayer = L.tileLayer(TILE_PROVIDERS[nextStyle].url, {
            attribution: TILE_PROVIDERS[nextStyle].attribution,
            maxZoom: 19
          }).addTo(map);
          currentStyle = nextStyle;
        }

        markersLayer.clearLayers();

        if (state.userLocation) {
          L.circleMarker([state.userLocation.latitude, state.userLocation.longitude], {
            radius: 8,
            color: "#FFFFFF",
            weight: 3,
            fillColor: "#7C3AED",
            fillOpacity: 1
          }).bindPopup(createPopupHtml("Você está aqui")).addTo(markersLayer);
        }

        var tilePane = map.getPane("tilePane");
        if (tilePane) {
          tilePane.style.filter = (state.isDark && state.tileStyle !== "satellite")
            ? "grayscale(100%) invert(100%) brightness(92%) contrast(92%)"
            : (state.tileStyle !== "satellite"
              ? "grayscale(100%) brightness(104%) contrast(90%)"
              : "none");
        }

        if (state.selectedLocation) {
          L.marker([state.selectedLocation.latitude, state.selectedLocation.longitude], {
            icon: createSelectedIcon(),
            interactive: false,
            keyboard: false,
            zIndexOffset: 1000
          }).addTo(markersLayer);
        }

        if (state.destinationLocation) {
          var destEl = document.createElement("div");
          destEl.style.cssText = "width:32px;height:32px;box-sizing:border-box;background:#8055B5;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(128,85,181,.55)";
          var dot = document.createElement("div");
          dot.style.cssText = "width:10px;height:10px;background:white;border-radius:50%";
          destEl.appendChild(dot);
          L.marker([state.destinationLocation.latitude, state.destinationLocation.longitude], {
            icon: L.divIcon({ className: "", html: destEl, iconSize: [34, 42], iconAnchor: [17, 36] }),
            zIndexOffset: 1100,
            interactive: isInteractive,
            keyboard: isInteractive,
            bubblingMouseEvents: false
          }).bindPopup(createPopupHtml("Destino da rota")).addTo(markersLayer);
        }

        (state.reports || []).forEach(function (report) {
          var m = L.marker([report.location.latitude, report.location.longitude], {
            icon: createReportIcon(report.category, getReportBorderColor(report)),
            title: report.category,
            interactive: isInteractive,
            keyboard: isInteractive,
            bubblingMouseEvents: false,
            riseOnHover: true
          }).addTo(markersLayer);
          m.on("click", function () {
            if (state.hasSelectReport) {
              postToApp("selectReport", { id: report.id });
            } else {
              m.bindPopup(createPopupHtml(report.category, report.description || "Sem descrição adicional.")).openPopup();
            }
          });
        });

        (state.supportLocations || []).forEach(function (loc) {
          var m = L.marker([loc.latitude, loc.longitude], {
            icon: createPoliceIcon(),
            title: loc.name,
            zIndexOffset: 500,
            interactive: isInteractive,
            keyboard: isInteractive,
            bubblingMouseEvents: false
          }).addTo(markersLayer);
          m.on("click", function () {
            if (state.hasSelectSupport) {
              postToApp("selectSupport", { id: loc.id });
            } else {
              var dist = typeof loc.distance_meters === "number"
                ? "Aproximadamente " + (loc.distance_meters / 1000).toFixed(1) + " km"
                : "Ponto de apoio";
              m.bindPopup(createPopupHtml(loc.name, dist)).openPopup();
            }
          });
        });

        routesLayer.clearLayers();
        var validRoutes = (state.routes || []).filter(function (r) {
          return Array.isArray(r.coordinates) && r.coordinates.length >= 2;
        });
        var active = validRoutes.find(function (r) { return r.id === state.selectedRouteId; })
          || validRoutes.find(function (r) { return r.isSelected; })
          || validRoutes[0];

        if (!active) {
          fittedRouteKey = null;
        } else {
          var baseOpts = { pane: "report-routes", lineCap: "round", lineJoin: "round", interactive: false };
          validRoutes.filter(function (r) { return r.id !== active.id; }).forEach(function (r) {
            L.polyline(r.coordinates.map(function (p) { return [p.latitude, p.longitude]; }), {
              pane: "report-routes",
              lineCap: "round",
              lineJoin: "round",
              interactive: false,
              color: state.isDark ? "#6D28D9" : "#C4B5FD",
              weight: r.weight || 4,
              opacity: r.opacity || 0.7
            }).addTo(routesLayer);
          });

          var coords = active.coordinates.map(function (p) { return [p.latitude, p.longitude]; });
          L.polyline(coords, {
            pane: "report-routes",
            lineCap: "round",
            lineJoin: "round",
            interactive: false,
            color: state.isDark ? "#1E1630" : "#2E1065",
            weight: (active.weight || 5) + 3,
            opacity: 0.9
          }).addTo(routesLayer);

          var mainLine = L.polyline(coords, {
            pane: "report-routes",
            lineCap: "round",
            lineJoin: "round",
            interactive: false,
            color: state.isDark ? "#C4A5F3" : "#5B21B6",
            weight: active.weight || 5,
            opacity: active.opacity || 1
          }).addTo(routesLayer);

          var vpKey = JSON.stringify([active.id, coords]);
          if (fittedRouteKey !== vpKey) {
            try {
              map.fitBounds(mainLine.getBounds(), {
                paddingTopLeft: [70, 40],
                paddingBottomRight: [40, 260],
                maxZoom: 16
              });
              fittedRouteKey = vpKey;
            } catch (e) {}
          }
        }

        zonesLayer.clearLayers();
        (state.riskZones || []).forEach(function (zone) {
          var color = zone.risk_level === "high" ? "#DC2626" : zone.risk_level === "medium" ? "#EA580C" : "#CA8A04";
          var opts = { color: color, fillColor: color, fillOpacity: 0.22, weight: 2, interactive: isInteractive };
          var shape = null;
          if (zone.polygon_coordinates && zone.polygon_coordinates.length) {
            shape = L.polygon(zone.polygon_coordinates.map(function (c) { return [c.latitude, c.longitude]; }), opts);
          } else if (zone.center) {
            shape = L.circle([zone.center.latitude, zone.center.longitude], Object.assign({}, opts, { radius: zone.radius_meters || 250 }));
          }
          if (shape) {
            shape.bindPopup(createPopupHtml(zone.name, "Área de atenção · " + zone.risk_level)).addTo(zonesLayer);
          }
        });
      };

      postToApp("ready", {});
    })();
  </script>
</body>
</html>`;
}
