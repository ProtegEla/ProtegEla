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

import {
  elapsed,
  getCategoryStyle,
  type DangerReport,
  type ReportComment,
} from "../reportModel";

type Props = {
  report: DangerReport | null;
  onClose: () => void;
  onToggleConfirmation: (id: string) => void;
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
  onAddComment,
}: Props) {
  const insets = useSafeAreaInsets();

  const [message, setMessage] = useState("");
  const [replyTo, setReplyTo] =
    useState<ReportComment | null>(null);

  const [expanded, setExpanded] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    setMessage("");
    setReplyTo(null);
    setExpanded({});
  }, [report?.id]);

  if (!report) return null;

  const category = getCategoryStyle(report.category);

  const badgeColor =
    report.category === "Violência"
      ? "#EC2027"
      : category.color;

  const comments = report.comments.filter(
    (comment) => !comment.parentId,
  );

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
    <Modal
      visible
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
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
            style={s.sheet}
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
                  color="#535968"
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
                style={s.address}
              >
                {report.address}
              </Text>

              {!!report.addressDetail && (
                <Text style={s.addressDetail}>
                  ({report.addressDetail})
                </Text>
              )}

              <View style={s.descriptionSection}>
                <Text style={s.sectionLabel}>
                  Descrição
                </Text>

                <Text style={s.description}>
                  {report.description
                    ? `“${report.description}”`
                    : "Sem descrição adicional."}
                </Text>
              </View>

              <View style={s.metadata}>
                <View style={s.metaItem}>
                  <Ionicons
                    name="time-outline"
                    size={20}
                    color="#8554BB"
                  />
                  <Text style={s.metaText}>
                    {elapsed(report.createdAt)}
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
                      color="#8554BB"
                    />
                    <Text
                      style={[
                        s.metaText,
                        { flex: 1 },
                      ]}
                    >
                      {PERIOD_DESCRIPTIONS[
                        report.period
                      ] ?? report.period}
                    </Text>
                  </View>
                )}
              </View>

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
                onPress={() =>
                  onToggleConfirmation(report.id)
                }
                style={s.confirmation}
              >
                <Ionicons
                  name={
                    report.confirmedByMe
                      ? "thumbs-up"
                      : "thumbs-up-outline"
                  }
                  size={17}
                  color="#8554BB"
                />

                <Text style={s.metaText}>
                  {report.confirmations_count}{" "}
                  {report.confirmations_count === 1
                    ? "confirmação"
                    : "confirmações"}
                  {report.confirmedByMe
                    ? " · você confirmou"
                    : ""}
                </Text>
              </Pressable>

              <Text
                accessibilityRole="header"
                style={s.commentsTitle}
              >
                Comentários
              </Text>

              {!comments.length && (
                <Text style={s.emptyText}>
                  Ainda não há comentários.
                </Text>
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
                      isMine && s.myCommentCard,
                    ]}
                  >
                    <View style={s.authorRow}>
                      <Text style={s.author}>
                        {isMine
                          ? "Você"
                          : comment.author}
                      </Text>

                      <Text style={s.timestamp}>
                        {elapsed(
                          comment.createdAt,
                        ).toLowerCase()}
                      </Text>
                    </View>

                    <Text style={s.commentText}>
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
                              color="#87909D"
                            />

                            <Text style={s.author}>
                              {reply.isMine
                                ? "Você"
                                : reply.author}
                            </Text>

                            <Text
                              style={s.timestamp}
                            >
                              {elapsed(
                                reply.createdAt,
                              ).toLowerCase()}
                            </Text>
                          </View>

                          <Text
                            style={s.replyText}
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
                            style={s.actionText}
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
                          style={s.actionText}
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
                    style={s.replyBannerText}
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
                      color="#8554BB"
                    />
                  </Pressable>
                </View>
              )}

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
                  placeholderTextColor="#81758E"
                  multiline
                  maxLength={500}
                  style={s.input}
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
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
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