"use client";

import { useState, useCallback, useRef } from "react";
import { sendMessage, getChatHistory } from "@/app/actions/chat";

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
}

export function useChat(initialNodeId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const currentNodeIdRef = useRef<string | null>(initialNodeId);

  const loadHistory = useCallback(async (nodeId: string) => {
    currentNodeIdRef.current = nodeId;
    setError("");
    const result = await getChatHistory(nodeId);
    if (result.success && result.messages) {
      setMessages(result.messages);
    } else {
      setMessages([]);
    }
  }, []);

  const send = useCallback(async (nodeId: string, content: string) => {
    if (!content.trim() || isLoading) return;

    currentNodeIdRef.current = nodeId;
    setError("");

    // Optimistic user message
    const optimisticId = `temp-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: optimisticId,
      role: "user",
      content: content.trim(),
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    const result = await sendMessage(nodeId, content.trim());

    // Discard if node changed during request
    if (currentNodeIdRef.current !== nodeId) return;

    if (result.success && result.reply) {
      setMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m.id !== optimisticId);
        return [
          ...withoutOptimistic,
          { id: `usr-${Date.now()}`, role: "user", content: content.trim(), createdAt: new Date() },
          { id: `ai-${Date.now()}`, role: "assistant", content: result.reply!, createdAt: new Date() },
        ];
      });
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setError(result.error ?? "发送失败");
    }
    setIsLoading(false);
  }, [isLoading]);

  return { messages, isLoading, error, send, loadHistory, setError };
}
