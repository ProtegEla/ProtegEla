import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { riskZonesService } from "../../services/api/reports";
import { normalizeApiError } from "../../services/api/client";
import type { Schemas } from "../../services/api/contracts";

type Props = {
  zone: Schemas["ZoneFeature"];
  onClose: () => void;
  onOpenReport: (id: string) => void;
};

export function ZoneIncidentsModal({
  zone,
  onClose,
  onOpenReport,
}: Props) {
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<
    Schemas["IncidentRead"][]
  >([]);

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [more, setMore] = useState(false);
  const [retry, setRetry] = useState(0);

  const advancing = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError("");

    riskZonesService
      .incidents(zone.id, page, {
        signal: controller.signal,
      })
      .then((response) => {
        if (controller.signal.aborted) return;

        setItems((previous) =>
          page === 1
            ? response.data
            : [
                ...new Map(
                  [...previous, ...response.data].map(
                    (item) => [item.id, item],
                  ),
                ).values(),
              ],
        );

        setMore(
          response.meta.page *
            response.meta.page_size <
            response.meta.total_records,
        );
      })
      .catch((failure) => {
        if (!controller.signal.aborted) {
          setError(normalizeApiError(failure).message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          advancing.current = false;
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [zone.id, page, retry]);

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={[
          s.overlay,
          { paddingTop: insets.top + 12 },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar ocorrências"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />

        <View
          style={[
            s.sheet,
            {
              paddingBottom: Math.max(
                insets.bottom,
                20,
              ),
            },
          ]}
        >
          <View style={s.row}>
            <Text style={s.title}>
              Ocorrências da região
            </Text>

            <Pressable
              onPress={onClose}
              style={s.button}
            >
              <Text>Fechar</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ gap: 12 }}
          >
            {items.map((item) => {
              const content = (
                <>
                  <Text style={s.category}>
                    {item.category}
                  </Text>
                  <Text style={s.text}>
                    {item.description ||
                      "Sem descrição adicional."}
                  </Text>
                  <Text style={s.meta}>
                    {item.incident_date} ·{" "}
                    {item.source === "ssp"
                      ? "Base SSP"
                      : "Relato do aplicativo"}
                  </Text>
                </>
              );

              if (
                item.source === "app" &&
                item.report_id
              ) {
                const reportId = item.report_id;

                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    onPress={() =>
                      onOpenReport(reportId)
                    }
                    style={s.card}
                  >
                    {content}
                    <Text style={s.link}>
                      Abrir detalhes
                    </Text>
                  </Pressable>
                );
              }

              return (
                <View
                  key={item.id}
                  style={s.card}
                >
                  {content}
                </View>
              );
            })}

            {loading && (
              <ActivityIndicator color="#8055B5" />
            )}

            {!!error && (
              <>
                <Text accessibilityRole="alert">
                  {error}
                </Text>
                <Pressable
                  onPress={() =>
                    setRetry((value) => value + 1)
                  }
                  style={s.button}
                >
                  <Text>Tentar novamente</Text>
                </Pressable>
              </>
            )}

            {!loading && !error && more && (
              <Pressable
                onPress={() => {
                  if (advancing.current) return;

                  advancing.current = true;
                  setPage((value) => value + 1);
                }}
                style={s.button}
              >
                <Text>Carregar mais</Text>
              </Pressable>
            )}

            {!loading &&
              !error &&
              items.length === 0 && (
                <Text>
                  Nenhuma ocorrência disponível.
                </Text>
              )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    backgroundColor: "rgba(24,16,36,0.4)",
  },
  sheet: {
    width: "100%",
    maxWidth: 500,
    maxHeight: "88%",
    padding: 22,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: "#EAE4F2",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
  },
  title: {
    flex: 1,
    fontSize: 21,
    fontWeight: "700",
    color: "#593582",
  },
  card: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 16,
    gap: 7,
  },
  category: {
    color: "#8055B5",
    fontWeight: "700",
  },
  text: {
    color: "#465064",
    lineHeight: 21,
  },
  meta: {
    color: "#64748B",
    fontSize: 12,
  },
  link: {
    color: "#8055B5",
    fontWeight: "600",
    marginTop: 6,
  },
  button: {
    minHeight: 44,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});