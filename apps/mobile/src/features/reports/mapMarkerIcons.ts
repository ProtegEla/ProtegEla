const SVG_START = `
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="white"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
`;

const ICONS = {
  furto: `${SVG_START}
    <path d="M5 8h14l1 13H4L5 8Z" />
    <path d="M8 8V6a4 4 0 0 1 8 0v2" />
    <path d="M8 11v1M16 11v1" />
  </svg>`,

  violencia: `${SVG_START}
    <path d="M6 17v-5a6 6 0 0 1 12 0v5" />
    <rect x="4" y="17" width="16" height="4" rx="1" />
    <path d="M12 2v2M4 5l2 2M20 5l-2 2" />
    <path d="M9 13v2" />
  </svg>`,

  assedio: `${SVG_START}
    <circle cx="9" cy="6" r="3" />
    <path d="M3 21v-3a6 6 0 0 1 12 0v3" />
    <path d="M19 6v7" />
    <circle
      cx="19"
      cy="17"
      r="1"
      fill="white"
      stroke="none"
    />
  </svg>`,

  iluminacao: `${SVG_START}
    <path d="M14 21V5a3 3 0 0 0-6 0" />
    <path d="M5 7h6l-1-3H6L5 7Z" />
    <path d="M8 10v2M3 9l2 1M13 9l-2 1" />
    <path d="M10 21h8" />
  </svg>`,

  outro: `${SVG_START}
    <path d="M12 4 2 21h20L12 4Z" />
    <path d="M12 10v4" />
    <circle
      cx="12"
      cy="17"
      r="1"
      fill="white"
      stroke="none"
    />
  </svg>`,
};

function normalizeCategory(category: string) {
  return category
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function createReportMarkerIcon(
  L: any,
  category: string,
) {
  const normalized = normalizeCategory(category);

  let color = "#8055B5";
  let svg = ICONS.outro;

  switch (normalized) {
    case "furto":
      color = "#F59E0B";
      svg = ICONS.furto;
      break;

    case "roubo":
      color = "#EA580C";
      svg = ICONS.furto;
      break;

    case "violencia":
      color = "#EC2027";
      svg = ICONS.violencia;
      break;

    case "assedio":
      color = "#F97316";
      svg = ICONS.assedio;
      break;

    case "ma iluminacao":
      color = "#E8B600";
      svg = ICONS.iluminacao;
      break;
  }

  const element = document.createElement("div");

  element.style.cssText = `
    width: 30px;
    height: 30px;
    box-sizing: border-box;
    border: 2px solid white;
    border-radius: 50%;
    background: ${color};
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  `;

  // SVG vem exclusivamente da tabela estática acima.
  element.innerHTML = svg;

  return L.divIcon({
    className: "",
    html: element,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

export function createSelectedLocationIcon(L: any) {
  const element = document.createElement("div");

  element.style.cssText = `
    width: 34px;
    height: 38px;
    filter: drop-shadow(0 3px 4px rgba(0,0,0,0.3));
    display: flex;
    justify-content: center;
    align-items: center;
  `;

  element.innerHTML = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="34"
      height="38"
      viewBox="0 0 24 28"
      aria-hidden="true"
    >
      <path
        d="M12 2C7.58 2 4 5.58 4 10c0 5.25 8 16 8 16s8-10.75 8-16c0-4.42-3.58-8-8-8z"
        fill="#8055B5"
        stroke="white"
        stroke-width="1.5"
      />
      <circle cx="12" cy="10" r="3.5" fill="white" />
    </svg>
  `;

  return L.divIcon({
    className: "",
    html: element,
    iconSize: [34, 38],
    iconAnchor: [17, 36],
  });
}

export function createPoliceStationIcon(L: any) {
  const element = document.createElement("div");

  element.style.cssText = `
    width: 32px;
    height: 32px;
    box-sizing: border-box;
    border: 2px solid white;
    border-radius: 50%;
    background: #6D4DA8;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  `;

  element.innerHTML = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  `;

  return L.divIcon({
    className: "",
    html: element,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}