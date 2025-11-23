/**
 * Frontend Context Optimization Utilities
 * 
 * This module provides simplified context handling for the frontend.
 * The backend now handles all context building with smart limits.
 */

import { Message } from '../types';

/**
 * Load SubChat histories from MongoDB only (no localStorage)
 * This is now the single source of truth
 */
export async function loadSubChatHistoriesFromMongoDB(
  conversationId: string,
  messages: Message[]
): Promise<SubChatHistory[]> {
  try {
    // Extract SubChat summaries from system messages
    const subChatSystemMessages = messages.filter(
      m => m.role === 'system' && m.content.includes('[SUBCHAT_SUMMARY]')
    );

    const histories: SubChatHistory[] = [];

    subChatSystemMessages.forEach((msg, index) => {
      try {
        const content = msg.content;

        // Parse SubChat data from system message
        const parentMessageIdMatch = content.match(/Parent Message ID: ([^\n]+)/);
        const selectedTextMatch = content.match(/Selected Text: "([^"]+)"/);
        const summaryMatch = content.match(/Summary: ([^\n]+)/);
        const detailedMatch = content.match(
          /Detailed Summary: ([^\n]+(?:\n(?!Full Exchanges:|Question Count:|Merged At:)[^\n]+)*)/
        );
        const fullExchangesMatch = content.match(
          /Full Exchanges:\n([\s\S]+?)(?=\nQuestion Count:|$)/
        );
        const questionCountMatch = content.match(/Question Count: (\d+)/);
        const mergedAtMatch = content.match(/Merged At: (.+?)$/m);

        const parentMessageId = parentMessageIdMatch ? parentMessageIdMatch[1] : '';
        const selectedText = selectedTextMatch ? selectedTextMatch[1] : '';
        const summary = summaryMatch ? summaryMatch[1] : 'Discussion occurred';
        const detailedSummary = detailedMatch ? detailedMatch[1].trim() : summary;
        const questionCount = questionCountMatch ? parseInt(questionCountMatch[1]) : 0;
        const mergedAt = mergedAtMatch ? mergedAtMatch[1] : msg.created_at;

        // Only add if we have a valid parent message ID
        if (!parentMessageId) {
          console.warn(`⚠️ SubChat ${index + 1} missing parent message ID, skipping`);
          return;
        }

        // Parse Full Exchanges back into Message objects
        const subChatMessages: Message[] = [];
        if (fullExchangesMatch) {
          const exchangesText = fullExchangesMatch[1];
          const qaPattern = /Q(\d+): ([\s\S]+?)\nA\1: ([\s\S]+?)(?=\n\nQ\d+:|$)/g;
          let match;

          while ((match = qaPattern.exec(exchangesText)) !== null) {
            const questionNum = match[1];
            const question = match[2].trim();
            const answer = match[3].trim();

            // Create user message
            subChatMessages.push({
              id: `subchat_${msg.id}_q${questionNum}`,
              conversation_id: `subchat_${msg.id}`,
              role: 'user',
              content: question,
              is_summary: false,
              summary_details: null,
              created_at: mergedAt,
            });

            // Create assistant message
            subChatMessages.push({
              id: `subchat_${msg.id}_a${questionNum}`,
              conversation_id: `subchat_${msg.id}`,
              role: 'assistant',
              content: answer,
              is_summary: false,
              summary_details: null,
              created_at: mergedAt,
            });
          }
        }

        // Create SubChat history object
        const subChatHistory: SubChatHistory = {
          id: `subchat_${msg.id}`,
          parentMessageId,
          selectedText,
          summary,
          detailedSummary,
          questionCount,
          topics: selectedText,
          mergedAt,
          messages: subChatMessages,
        };

        histories.push(subChatHistory);
        console.log(
          `✅ Loaded SubChat ${index + 1}:`,
          selectedText.substring(0, 50),
          '→ Parent:',
          parentMessageId.substring(0, 20),
          `→ ${subChatMessages.length} messages`
        );
      } catch (parseError) {
        console.error('❌ Error parsing SubChat summary:', parseError);
      }
    });

    console.log(`✅ Total SubChat histories loaded: ${histories.length}`);
    return histories;
  } catch (error) {
    console.error('❌ Error loading SubChat histories from MongoDB:', error);
    return [];
  }
}

/**
 * SubChat History interface
 */
export interface SubChatHistory {
  id: string;
  parentMessageId: string;
  selectedText: string;
  summary: string;
  detailedSummary: string;
  questionCount: number;
  topics: string;
  mergedAt: string;
  messages?: Message[];
}

/**
 * Clean up old localStorage SubChat data (migration helper)
 * Call this once to remove legacy localStorage entries
 */
export function cleanupLegacySubChatStorage(): void {
  try {
    console.log('🧹 Cleaning up legacy SubChat localStorage...');

    // Remove old global storage
    const legacyGlobalKey = 'global_subchat_histories';
    if (localStorage.getItem(legacyGlobalKey)) {
      localStorage.removeItem(legacyGlobalKey);
      console.log('✅ Removed legacy global SubChat storage');
    }

    // Remove old conversation-specific storage
    let removed = 0;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith('subchat_histories_')) {
        localStorage.removeItem(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`✅ Removed ${removed} legacy SubChat storage entries`);
    }

    console.log('✅ Legacy SubChat storage cleanup complete');
  } catch (error) {
    console.error('❌ Error during legacy cleanup:', error);
  }
}

/**
 * Estimate token count for text
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Check if context is within limits
 */
export function isContextWithinLimits(
  messages: Message[],
  maxTokens: number = 8000
): boolean {
  const totalTokens = messages.reduce(
    (sum, msg) => sum + estimateTokens(msg.content),
    0
  );
  return totalTokens <= maxTokens;
}

/**
 * Get context summary for display
 */
export function getContextSummary(messages: Message[]): {
  messageCount: number;
  estimatedTokens: number;
  hasSubChats: boolean;
  hasPreviousKnowledge: boolean;
} {
  const messageCount = messages.length;
  const estimatedTokens = messages.reduce(
    (sum, msg) => sum + estimateTokens(msg.content),
    0
  );
  const hasSubChats = messages.some(
    m => m.role === 'system' && m.content.includes('[SUBCHAT_SUMMARY]')
  );
  const hasPreviousKnowledge = messages.some(
    m => m.role === 'system' && m.content.includes('PREVIOUS KNOWLEDGE')
  );

  return {
    messageCount,
    estimatedTokens,
    hasSubChats,
    hasPreviousKnowledge,
  };
}
