import type { Schemas } from "./contracts";

export type Coordinates = Schemas["RoutePoint"];

export type ReportFormData = {
  location: Coordinates;
  address: string;
  addressDetail: string;
  category: string;
  description: string;
  period: string;
  isAnonymous: boolean;
  incidentDate: string;
  incidentTime?: string;
};

export type Comment = {
  id: string;
  author: string;
  text: string;
  createdAt: string;
  parentId?: string;
  isMine?: boolean;
  isDeleted?: boolean;
};

export type Detail = {
  id: string;
  category: Schemas["ReportCategory"];
  description: string;
  location: Coordinates;
  address: string;
  addressDetail: string;
  period: string;
  isAnonymous: boolean;
  author: string;
  createdAt: string;
  incidentDate?: string;
  incidentTime?: string;
  confirmations_count: number | null;
  confirmedByMe: boolean;
  abuseRegistered?: boolean;
  comments: Comment[];
};

export function localToday() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

export function buildReportPayload(
  form: ReportFormData,
): Schemas["ReportCreate"] {
  const { latitude, longitude } = form.location;

  if (
    ![latitude, longitude].every(Number.isFinite) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    throw new Error("Selecione um local válido.");
  }

  const categories: Schemas["ReportCategory"][] = [
    "Assédio",
    "Furto",
    "Violência",
    "Má iluminação",
  ];

  const periods: Schemas["IncidentPeriod"][] = [
    "manha",
    "tarde",
    "noite",
    "madrugada",
  ];

  if (
    !categories.includes(
      form.category as Schemas["ReportCategory"],
    )
  ) {
    throw new Error("Selecione uma categoria válida.");
  }

  if (
    !periods.includes(
      form.period as Schemas["IncidentPeriod"],
    )
  ) {
    throw new Error("Selecione um período válido.");
  }

  const date = `${form.incidentDate}T12:00:00Z`;

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(form.incidentDate) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !==
      form.incidentDate
  ) {
    throw new Error(
      "Informe uma data válida no formato AAAA-MM-DD.",
    );
  }

  const time = form.incidentTime?.trim();

  if (
    time &&
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  ) {
    throw new Error("Informe o horário no formato HH:mm.");
  }

  const description = form.description.trim();

  if (description.length > 1000) {
    throw new Error(
      "Use até 1.000 caracteres na descrição.",
    );
  }

  // O backend possui somente address_reference.
  const reference = [
    form.address.trim(),
    form.addressDetail.trim(),
  ]
    .filter(Boolean)
    .join(" — ");

  if (reference.length > 255) {
    throw new Error(
      "Endereço e complemento devem somar até 255 caracteres.",
    );
  }

  return {
    location: {
      latitude,
      longitude,
      address_reference: reference || null,
    },
    category: form.category as Schemas["ReportCategory"],
    description: description || null,
    incident_date: form.incidentDate,
    incident_period: form.period as Schemas["IncidentPeriod"],
    incident_time: time ? `${time}:00` : null,
    is_anonymous: form.isAnonymous,
  };
}

export function adaptComment(
  value: Schemas["CommentRead"],
  isMine = false,
): Comment {
  return {
    id: value.id,
    author: value.author ?? "Usuária",
    text: value.is_deleted
      ? "Comentário excluído."
      : value.text ?? "",
    createdAt: value.created_at,
    parentId: value.parent_id ?? undefined,
    isMine,
    isDeleted: value.is_deleted,
  };
}

export function adaptReport(
  value:
    | Schemas["ReportRead"]
    | Schemas["ReportDetailData"],
  comments: Comment[] = [],
): Detail {
  return {
    id: value.id,
    category: value.category,
    description: value.description ?? "",
    location: {
      latitude: value.location.latitude,
      longitude: value.location.longitude,
    },
    address:
      value.location.address_reference ||
      `${value.location.latitude.toFixed(5)}, ${value.location.longitude.toFixed(5)}`,
    addressDetail: "",
    period: value.incident_period,
    isAnonymous: value.is_anonymous,
    author: value.is_anonymous
      ? "Anônima"
      : "Autora do relato",
    createdAt: value.created_at,
    incidentDate: value.incident_date,
    incidentTime: value.incident_time ?? undefined,
    confirmations_count:
      "confirmations_count" in value
        ? value.confirmations_count
        : null,
    confirmedByMe: false,
    abuseRegistered: false,
    comments,
  };
}