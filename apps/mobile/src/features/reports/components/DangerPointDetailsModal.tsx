import React, { useEffect, useState } from "react";

import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../../theme";

import {
  elapsed,
  getCategoryStyle,
  type DangerReport,
  type ReportComment,
} from "../reportModel";

type Props = {
  report: DangerReport | null;
  onClose: () => void;
  onToggleConfirmation: (id: string) => Promise<string | void> | void;
  onReportAbuse?: (id: string) => Promise<string | void> | void;
  onAddComment: (
    reportId: string,
    text: string,
    parentId?: string,
  ) => void;
};

const PERIOD_DESCRIPTIONS: Record<string, string> = {
  manha: "Período da manhã",
  tarde: "Período da tarde",
  noite: "Período da noite",
  madrugada: "Período da madrugada",
};

export function DangerPointDetailsModal({
  report,
  onClose,
  onToggleConfirmation,
  onReportAbuse,
  onAddComment,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();

  const [message, setMessage] = useState("");
  const [replyTo, setReplyTo] =
    useState<ReportComment | null>(null);
  const [interactionNotice, setInteractionNotice] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    setMessage("");
    setReplyTo(null);
    setInteractionNotice(null);
    setExpanded({});
  }, [report?.id]);

  if (!report) return null;

  const isSsp = report.source === "ssp";
  const category = getCategoryStyle(report.category);
  const formatRealDate = (isoDate?: string): string | null => {
    if (!isoDate) return null;
    const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : null;
  };
  const realDate =
    formatRealDate(report.incidentDate) ??
    formatRealDate(report.createdAt);

  const badgeColor =
    report.category === "Violência"
      ? "#EC2027"
      : report.category === "Roubo"
        ? "#EA580C"
        : category.color;

  const comments = report.comments.filter(
    (comment) => !comment.parentId,
  );

  const theme = {
    overlayBg: isDark ? "rgba(8, 5, 14, 0.65)" : "rgba(25, 18, 35, 0.35)",
    sheetBg: isDark ? colors.surface : "#EAE4F2",
    accent: isDark ? colors.profileTitlePurple : "#8554BB",
    titleAccent: isDark ? colors.profileTitlePurple : "#A17ACB",
    bodyText: isDark ? colors.text : "#465064",
    authorText: isDark ? colors.text : "#4B5568",
    mutedText: isDark ? colors.textMuted : "#81758E",
    timestampText: isDark ? colors.textMuted : "#87909D",
    closeIcon: isDark ? colors.textMuted : "#535968",
    commentCardBg: isDark ? colors.inputBackground : "#F8FAFC",
    myCommentCardBg: isDark ? "#342352" : "#CEC0DF",
    inputBg: isDark ? colors.inputBackground : "#CEC0DF",
  };

  function sendComment() {
    if (!report || !message.trim()) return;

    onAddComment(
      report.id,
      message.trim(),
      replyTo?.id,
    );

    if (replyTo) {
      setExpanded((previous) => ({
        ...previous,
        [replyTo.id]: true,
      }));
    }

    setMessage("");
    setReplyTo(null);
  }

  return (
    <View style={s.modalContainer} pointerEvents="box-none">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={
          Platform.OS === "ios" ? "padding" : "height"
        }
      >
        <View
          style={[
            s.overlay,
            {
              backgroundColor: theme.overlayBg,
              paddingTop: Math.max(insets.top, 12),
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar detalhes"
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />

          <View
            accessibilityViewIsModal
            style={[s.sheet, { backgroundColor: theme.sheetBg }]}
          >
            <View style={s.topRow}>
              <View
                style={[
                  s.badge,
                  { backgroundColor: badgeColor },
                ]}
              >
                <Text style={s.badgeText}>
                  {report.category}
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fechar detalhes"
                onPress={onClose}
                style={s.close}
              >
                <Ionicons
                  name="close-outline"
                  size={28}
                  color={theme.closeIcon}
                />
              </Pressable>
            </View>

            <ScrollView
              style={{ flexShrink: 1 }}
              contentContainerStyle={s.content}
              keyboardShouldPersistTaps="handled"
            >
              <Text
                accessibilityRole="header"
                style={[s.address, { color: theme.accent }]}
              >
                {report.address}
              </Text>

              {!!report.addressDetail && (
                <Text style={[s.addressDetail, { color: theme.accent }]}>
                  ({report.addressDetail})
                </Text>
              )}

              <View style={s.descriptionSection}>
                <Text style={[s.sectionLabel, { color: theme.accent }]}>
                  Descrição
                </Text>

                <Text style={[s.description, { color: theme.bodyText }]}>
                  {report.description
                    ? `“${report.description}”`
                    : "Sem descrição adicional."}
                </Text>
              </View>

              <View style={s.metadata}>
                <View style={s.metaItem}>
                  <Ionicons
                    name={isSsp ? "calendar-outline" : "time-outline"}
                    size={20}
                    color={theme.accent}
                  />
                  <Text style={[s.metaText, { color: theme.accent }]}>
                    {isSsp
                      ? realDate
                        ? `Ocorrência em ${realDate}`
                        : "Base oficial SSP-SP (2026)"
                      : realDate
                        ? `${realDate} · ${elapsed(report.createdAt)}`
                        : elapsed(report.createdAt)}
                  </Text>
                </View>

                {!!report.period && (
                  <View
                    style={[
                      s.metaItem,
                      { flex: 1 },
                    ]}
                  >
                    <Ionicons
                      name="moon"
                      size={19}
                      color={theme.accent}
                    />
                    <Text
                      style={[
                        s.metaText,
                        { color: theme.accent, flex: 1 },
                      ]}
                    >
                      {PERIOD_DESCRIPTIONS[
                        report.period
                      ] ?? report.period}
                    </Text>
                  </View>
                )}
              </View>

              {isSsp ? (
                <View style={s.confirmation}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={17}
                    color={theme.accent}
                  />
                  <Text style={[s.metaText, { color: theme.accent }]}>
                    {report.incidentsCount ?? report.confirmations_count}{" "}
                    {(report.incidentsCount ?? report.confirmations_count) === 1
                      ? "ocorrência oficial registrada neste ponto"
                      : "ocorrências oficiais registradas neste ponto"}
                  </Text>
                </View>
              ) : (
                <View>
                  <View style={s.interactionRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        report.confirmedByMe
                          ? "Desfazer minha confirmação"
                          : "Confirmar este relato"
                      }
                      accessibilityState={{
                        selected: report.confirmedByMe,
                      }}
                      onPress={async () => {
                        setInteractionNotice(null);
                        const feedback = await onToggleConfirmation(report.id);
                        if (typeof feedback === "string" && feedback) {
                          setInteractionNotice(feedback);
                        }
                      }}
                      style={s.confirmation}
                    >
                      <Ionicons
                        name={
                          report.confirmedByMe
                            ? "thumbs-up"
                            : "thumbs-up-outline"
                        }
                        size={17}
                        color={theme.accent}
                      />

                      <Text style={[s.metaText, { color: theme.accent }]}>
                        {report.confirmations_count}{" "}
                        {report.confirmations_count === 1
                          ? "confirmação"
                          : "confirmações"}
                        {report.confirmedByMe
                          ? " · você confirmou"
                          : ""}
                      </Text>
                    </Pressable>

                    {!!onReportAbuse && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Denunciar este relato"
                        onPress={async () => {
                          setInteractionNotice(null);
                          const feedback = await onReportAbuse(report.id);
                          if (typeof feedback === "string" && feedback) {
                            setInteractionNotice(feedback);
                          }
                        }}
                        style={s.abuseBtn}
                      >
                        <Ionicons
                          name="flag-outline"
                          size={15}
                          color="#DC2626"
                        />
                        <Text style={s.abuseBtnText}>Denunciar</Text>
                      </Pressable>
                    )}
                  </View>

                  {!!interactionNotice && (
                    <Text style={[s.interactionNotice, { color: theme.mutedText }]}>
                      {interactionNotice}
                    </Text>
                  )}
                </View>
              )}

              {!isSsp && (
                <>
                  <Text
                    accessibilityRole="header"
                    style={[s.commentsTitle, { color: theme.titleAccent }]}
                  >
                    Comentários
                  </Text>

                  {!comments.length && (
                    <Text style={[s.emptyText, { color: theme.mutedText }]}>
                      Ainda não há comentários.
                    </Text>
                  )}
                </>
              )}

              {comments.map((comment) => {
                const replies =
                  report.comments.filter(
                    (item) =>
                      item.parentId === comment.id,
                  );

                const isMine =
                  comment.isMine ??
                  comment.author === "Você";

                const showReplies =
                  expanded[comment.id] ?? true;

                return (
                  <View
                    key={comment.id}
                    style={[
                      s.commentCard,
                      { backgroundColor: theme.commentCardBg },
                      isMine && { backgroundColor: theme.myCommentCardBg },
                    ]}
                  >
                    <View style={s.authorRow}>
                      <Text style={[s.author, { color: theme.authorText }]}>
                        {isMine
                          ? "Você"
                          : comment.author}
                      </Text>

                      <Text style={[s.timestamp, { color: theme.timestampText }]}>
                        {elapsed(
                          comment.createdAt,
                        ).toLowerCase()}
                      </Text>
                    </View>

                    <Text style={[s.commentText, { color: theme.bodyText }]}>
                      {comment.text}
                    </Text>

                    {!!replies.length &&
                      showReplies &&
                      replies.map((reply) => (
                        <View
                          key={reply.id}
                          style={s.reply}
                        >
                          <View style={s.replyHeading}>
                            <Ionicons
                              name="return-down-forward"
                              size={17}
                              color={theme.timestampText}
                            />

                            <Text style={[s.author, { color: theme.authorText }]}>
                              {reply.isMine
                                ? "Você"
                                : reply.author}
                            </Text>

                            <Text
                              style={[s.timestamp, { color: theme.timestampText }]}
                            >
                              {elapsed(
                                reply.createdAt,
                              ).toLowerCase()}
                            </Text>
                          </View>

                          <Text
                            style={[s.replyText, { color: theme.bodyText }]}
                          >
                            {reply.text}
                          </Text>
                        </View>
                      ))}

                    <View
                      style={s.commentActions}
                    >
                      {!!replies.length && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{
                            expanded: showReplies,
                          }}
                          onPress={() =>
                            setExpanded(
                              (previous) => ({
                                ...previous,
                                [comment.id]:
                                  !showReplies,
                              }),
                            )
                          }
                          style={s.textButton}
                        >
                          <Text
                            style={[s.actionText, { color: theme.authorText }]}
                          >
                            {showReplies
                              ? "Ocultar respostas"
                              : `Ver respostas (${replies.length})`}
                          </Text>
                        </Pressable>
                      )}

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Responder a ${comment.author}`}
                        onPress={() =>
                          setReplyTo(comment)
                        }
                        style={s.textButton}
                      >
                        <Text
                          style={[s.actionText, { color: theme.authorText }]}
                        >
                          Responder
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <View
              style={[
                s.footer,
                {
                  backgroundColor: theme.sheetBg,
                  paddingBottom: Math.max(
                    insets.bottom,
                    22,
                  ),
                },
              ]}
            >
              {replyTo && (
                <View style={s.replyBanner}>
                  <Text
                    style={[s.replyBannerText, { color: theme.accent }]}
                  >
                    Respondendo a{" "}
                    {replyTo.author}
                  </Text>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Cancelar resposta"
                    onPress={() =>
                      setReplyTo(null)
                    }
                    style={s.cancelReply}
                  >
                    <Ionicons
                      name="close"
                      size={17}
                      color={theme.accent}
                    />
                  </Pressable>
                </View>
              )}

              {!isSsp ? (
                <View style={s.composer}>
                  <TextInput
                    accessibilityLabel={
                      replyTo
                        ? "Escrever resposta"
                        : "Escrever comentário"
                    }
                    value={message}
                    onChangeText={setMessage}
                    placeholder={
                      replyTo
                        ? "Adicionar resposta..."
                        : "Adicionar comentário..."
                    }
                    placeholderTextColor={theme.mutedText}
                    multiline
                    maxLength={500}
                    style={[
                      s.input,
                      {
                        backgroundColor: theme.inputBg,
                        color: theme.bodyText,
                      },
                    ]}
                  />

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      replyTo
                        ? "Enviar resposta"
                        : "Enviar comentário"
                    }
                    disabled={!message.trim()}
                    onPress={sendComment}
                    style={({ pressed }) => [
                      s.send,
                      !message.trim() && {
                        opacity: 0.65,
                      },
                      pressed && {
                        opacity: 0.8,
                      },
                    ]}
                  >
                    <Ionicons
                      name="arrow-up"
                      size={26}
                      color="#FFFFFF"
                    />
                  </Pressable>
                </View>
              ) : (
                <Text style={[s.emptyText, { color: theme.mutedText }]}>
                  Dados oficiais da SSP-SP são apenas informativos e não recebem comentários.
                </Text>
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  modalContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 45,
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    backgroundColor: "rgba(25, 18, 35, 0.35)",
  },
  sheet: {
    width: "100%",
    maxWidth: 430,
    maxHeight: "94%",
    backgroundColor: "#EAE4F2",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: "hidden",
  },
  topRow: {
    paddingTop: 12,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badge: {
    paddingHorizontal: 18,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  close: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -8,
  },
  content: {
    paddingHorizontal: 26,
    paddingBottom: 4,
  },
  address: {
    color: "#8554BB",
    fontSize: 28,
    lineHeight: 33,
    fontWeight: "600",
    letterSpacing: -0.4,
    marginTop: 3,
  },
  addressDetail: {
    color: "#8554BB",
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "500",
    marginTop: 4,
  },
  descriptionSection: {
    marginTop: 32,
  },
  sectionLabel: {
    color: "#8554BB",
    fontSize: 16,
    fontWeight: "600",
  },
  description: {
    color: "#465064",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
  },
  metadata: {
    flexDirection: "row",
    alignItems: "flex-start",
    flexWrap: "wrap",
    columnGap: 24,
    rowGap: 10,
    marginTop: 18,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  metaText: {
    color: "#8554BB",
    fontSize: 14,
    lineHeight: 20,
  },
  confirmation: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 3,
  },
  interactionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  abuseBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.35)",
  },
  abuseBtnText: {
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "600",
  },
  interactionNotice: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  commentsTitle: {
    color: "#A17ACB",
    fontSize: 17,
    fontWeight: "600",
    marginTop: 24,
    marginBottom: 12,
  },
  emptyText: {
    color: "#81758E",
    fontSize: 13,
    marginBottom: 14,
  },
  commentCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
    marginBottom: 12,
  },
  myCommentCard: {
    backgroundColor: "#CEC0DF",
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 14,
  },
  author: {
    color: "#4B5568",
    fontSize: 14,
  },
  timestamp: {
    color: "#87909D",
    fontSize: 11,
  },
  commentText: {
    color: "#465064",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  reply: {
    marginTop: 12,
  },
  replyHeading: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  replyText: {
    color: "#465064",
    fontSize: 12,
    lineHeight: 18,
    marginLeft: 23,
    marginTop: 3,
  },
  commentActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 16,
  },
  textButton: {
    minHeight: 36,
    justifyContent: "center",
  },
  actionText: {
    color: "#4B5568",
    fontSize: 12,
  },
  footer: {
    paddingHorizontal: 26,
    paddingTop: 8,
    gap: 8,
    backgroundColor: "#EAE4F2",
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 11,
    backgroundColor: "#CEC0DF",
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: "#465064",
    fontSize: 12,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: "#9D78C9",
    alignItems: "center",
    justifyContent: "center",
  },
  replyBanner: {
    flexDirection: "row",
    alignItems: "center",
  },
  replyBannerText: {
    flex: 1,
    color: "#8554BB",
    fontSize: 12,
  },
  cancelReply: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
});