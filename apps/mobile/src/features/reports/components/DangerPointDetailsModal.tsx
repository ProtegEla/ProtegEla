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
  DangerReport,
  ReportComment,
  PERIOD_LABELS,
  elapsed,
  getCategoryStyle,
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
        style={s.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View
          style={[
            s.overlay,
            { paddingTop: Math.max(insets.top, 16) },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar detalhes"
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />

          <View accessibilityViewIsModal style={s.sheet}>
            <View style={s.handle} />

            <View style={s.header}>
              <View style={{ flex: 1 }}>
                <Text
                  accessibilityRole="header"
                  style={s.title}
                >
                  Ponto de perigo
                </Text>
                <Text style={s.subtitle}>
                  Relato compartilhado pela comunidade
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fechar detalhes"
                onPress={onClose}
                style={s.close}
              >
                <Ionicons
                  name="close"
                  size={22}
                  color="#593582"
                />
              </Pressable>
            </View>

            <ScrollView
              style={{ flexShrink: 1 }}
              contentContainerStyle={s.content}
              keyboardShouldPersistTaps="handled"
            >
              <View style={s.summary}>
                <View
                  style={[
                    s.badge,
                    { backgroundColor: category.background },
                  ]}
                >
                  <Text
                    style={[
                      s.badgeText,
                      { color: category.color },
                    ]}
                  >
                    {report.category}
                  </Text>
                </View>

                <Text style={s.address}>
                  {report.address}
                </Text>

                {!!report.addressDetail && (
                  <Text style={s.addressDetail}>
                    {report.addressDetail}
                  </Text>
                )}

                <View style={s.divider} />

                <Text style={s.label}>O que aconteceu</Text>

                <Text style={s.description}>
                  {report.description ||
                    "Sem descrição adicional."}
                </Text>

                <View style={s.metadata}>
                  <View style={s.metaItem}>
                    <Ionicons
                      name="calendar-outline"
                      size={16}
                      color="#8055B5"
                    />
                    <Text style={s.metaText}>
                      {elapsed(report.createdAt)}
                    </Text>
                  </View>

                  {!!report.period && (
                    <View style={s.metaItem}>
                      <Ionicons
                        name="time-outline"
                        size={16}
                        color="#8055B5"
                      />
                      <Text style={s.metaText}>
                        {PERIOD_LABELS[report.period] ??
                          report.period}
                      </Text>
                    </View>
                  )}
                </View>

                <Text style={s.byline}>
                  Relatado por{" "}
                  {report.isAnonymous
                    ? "Anônima"
                    : report.author}
                </Text>
              </View>

              <View style={s.confirmBox}>
                <Text style={s.confirmTitle}>
                  {report.confirmations_count}{" "}
                  {report.confirmations_count === 1
                    ? "confirmação"
                    : "confirmações"}{" "}
                  da comunidade
                </Text>

                <Text style={s.help}>
                  Confirme apenas se você conhece essa
                  situação.
                </Text>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    report.confirmedByMe
                      ? "Desfazer minha confirmação"
                      : "Confirmar este relato"
                  }
                  onPress={() =>
                    onToggleConfirmation(report.id)
                  }
                  style={({ pressed }) => [
                    s.confirmButton,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Ionicons
                    name={
                      report.confirmedByMe
                        ? "checkmark-circle"
                        : "checkmark-circle-outline"
                    }
                    size={20}
                    color="#593582"
                  />

                  <Text style={s.confirmButtonText}>
                    {report.confirmedByMe
                      ? "Confirmado por você · desfazer"
                      : "Também confirmo este relato"}
                  </Text>
                </Pressable>
              </View>

              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>
                  Comentários
                </Text>
                <Text style={s.count}>
                  {report.comments.length}
                </Text>
              </View>

              {!comments.length && (
                <Text style={s.help}>
                  Ainda não há comentários. Você pode iniciar
                  a conversa.
                </Text>
              )}

              {comments.map((comment) => {
                const replies = report.comments.filter(
                  (item) => item.parentId === comment.id,
                );

                return (
                  <View
                    key={comment.id}
                    style={s.commentCard}
                  >
                    <View style={s.authorRow}>
                      <View style={s.avatar}>
                        <Text style={s.avatarText}>
                          {comment.author.charAt(0)}
                        </Text>
                      </View>

                      <Text style={s.author}>
                        {comment.author}
                      </Text>

                      <Text style={s.timestamp}>
                        {elapsed(comment.createdAt)}
                      </Text>
                    </View>

                    <Text style={s.commentText}>
                      {comment.text}
                    </Text>

                    <View style={s.commentActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Responder a ${comment.author}`}
                        onPress={() => setReplyTo(comment)}
                        style={s.textButton}
                      >
                        <Text style={s.actionText}>
                          Responder
                        </Text>
                      </Pressable>

                      {!!replies.length && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{
                            expanded:
                              !!expanded[comment.id],
                          }}
                          onPress={() =>
                            setExpanded((previous) => ({
                              ...previous,
                              [comment.id]:
                                !previous[comment.id],
                            }))
                          }
                          style={s.textButton}
                        >
                          <Text style={s.actionText}>
                            {expanded[comment.id]
                              ? "Ocultar respostas"
                              : `Ver respostas (${replies.length})`}
                          </Text>
                        </Pressable>
                      )}
                    </View>

                    {expanded[comment.id] &&
                      replies.map((reply) => (
                        <View
                          key={reply.id}
                          style={s.reply}
                        >
                          <View style={s.authorRow}>
                            <Text style={s.author}>
                              {reply.author}
                            </Text>
                            <Text style={s.timestamp}>
                              {elapsed(reply.createdAt)}
                            </Text>
                          </View>

                          <Text style={s.commentText}>
                            {reply.text}
                          </Text>
                        </View>
                      ))}
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
                    16,
                  ),
                },
              ]}
            >
              {replyTo && (
                <View style={s.replyBanner}>
                  <Text style={s.replyBannerText}>
                    Respondendo a {replyTo.author}
                  </Text>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Cancelar resposta"
                    onPress={() => setReplyTo(null)}
                    style={s.cancelReply}
                  >
                    <Ionicons
                      name="close"
                      size={18}
                      color="#593582"
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
                      ? "Escreva sua resposta…"
                      : "Compartilhe um comentário…"
                  }
                  placeholderTextColor="#64748B"
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
                  style={[
                    s.send,
                    !message.trim() && { opacity: 0.4 },
                  ]}
                >
                  <Ionicons
                    name="arrow-up"
                    size={23}
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
  keyboard: { flex: 1 },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    backgroundColor: "rgba(24,16,36,0.48)",
  },
  sheet: {
    width: "100%",
    maxWidth: 620,
    maxHeight: "94%",
    backgroundColor: "#FAF8FD",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D6CBDD",
    alignSelf: "center",
    marginTop: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 22,
    paddingBottom: 16,
    gap: 12,
  },
  title: {
    color: "#1E293B",
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    color: "#64748B",
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F0EAF7",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: 22,
    paddingBottom: 24,
    gap: 18,
  },
  summary: {
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#DDD5E8",
    gap: 10,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 9,
  },
  badgeText: { fontSize: 12, fontWeight: "700" },
  address: {
    color: "#593582",
    fontSize: 23,
    lineHeight: 30,
    fontWeight: "700",
  },
  addressDetail: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 21,
  },
  divider: {
    height: 1,
    backgroundColor: "#E9E2F0",
    marginVertical: 6,
  },
  label: {
    color: "#1E293B",
    fontWeight: "700",
    fontSize: 14,
  },
  description: {
    color: "#1E293B",
    fontSize: 15,
    lineHeight: 24,
  },
  metadata: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginTop: 5,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: { color: "#593582", fontSize: 12 },
  byline: { color: "#64748B", fontSize: 12 },
  confirmBox: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#F0EAF7",
    gap: 10,
  },
  confirmTitle: {
    color: "#593582",
    fontWeight: "700",
    fontSize: 14,
  },
  help: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 20,
  },
  confirmButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  confirmButtonText: {
    flexShrink: 1,
    color: "#593582",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  sectionTitle: {
    color: "#1E293B",
    fontSize: 18,
    fontWeight: "700",
  },
  count: {
    color: "#593582",
    backgroundColor: "#F0EAF7",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: "700",
  },
  commentCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DDD5E8",
    backgroundColor: "#FFFFFF",
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F0EAF7",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#593582",
    fontSize: 12,
    fontWeight: "700",
  },
  author: {
    color: "#1E293B",
    fontSize: 13,
    fontWeight: "700",
  },
  timestamp: { color: "#64748B", fontSize: 11 },
  commentText: {
    color: "#1E293B",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
  },
  commentActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 16,
  },
  textButton: {
    minHeight: 44,
    justifyContent: "center",
  },
  actionText: {
    color: "#593582",
    fontSize: 12,
    fontWeight: "600",
  },
  reply: {
    borderLeftWidth: 2,
    borderLeftColor: "#D7C6EB",
    paddingLeft: 14,
    marginTop: 10,
    paddingVertical: 4,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#DDD5E8",
    backgroundColor: "#FFFFFF",
    gap: 10,
  },
  replyBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 10,
    borderRadius: 12,
    backgroundColor: "#F0EAF7",
  },
  replyBannerText: {
    flex: 1,
    color: "#593582",
    fontSize: 12,
  },
  cancelReply: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 50,
    maxHeight: 110,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DDD5E8",
    backgroundColor: "#F8FAFC",
    color: "#1E293B",
    fontSize: 14,
  },
  send: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: "#593582",
    alignItems: "center",
    justifyContent: "center",
  },
});