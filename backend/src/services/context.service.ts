import { Message } from '../models/Message';
import { Conversation } from '../models/Conversation';
import { llmService } from './llm.service';
import { logger } from '../utils/logger';
import { LLMMessage } from '../types';
import mongoose from 'mongoose';

// Smart context limits configuration
const CONTEXT_LIMITS = {
  recentMessages: 10,           // Always include last 10 messages
  semanticSearchResults: 5,     // Top 5 semantically similar messages
  subChatHistories: 5,          // Most recent 5 SubChat summaries
  previousConversations: 3,     // When enabled, include 3 previous conversations
  documentChunks: 5,            // Relevant document chunks
  maxTotalTokens: 8000,         // Hard token limit for context
  semanticThreshold: 0.7,       // Minimum similarity score
  embeddingBatchSize: 10,       // Process embeddings in batches
};

interface ContextOptions {
  includeSemanticSearch?: boolean;
  includeSubChats?: boolean;
  includePreviousKnowledge?: boolean;
  includeDocuments?: boolean;
  maxTokens?: number;
}

interface ContextResult {
  messages: LLMMessage[];
  metadata: {
    recentMessageCount: number;
    semanticMessageCount: number;
    subChatCount: number;
    previousConversationCount: number;
    estimatedTokens: number;
    truncated: boolean;
  };
}

export class ContextService {
  /**
   * Build optimized context for a conversation with smart limits
   */
  async buildOptimizedContext(
    conversationId: string,
    currentMessage: string,
    options: ContextOptions = {}
  ): Promise<ContextResult> {
    const {
      includeSemanticSearch = true,
      includeSubChats = true,
      includePreviousKnowledge = false,
      includeDocuments = false,
      maxTokens = CONTEXT_LIMITS.maxTotalTokens,
    } = options;

    logger.info('Building optimized context', {
      conversationId,
      messageLength: currentMessage.length,
      options,
    });

    const contextMessages: LLMMessage[] = [];
    let estimatedTokens = 0;
    const metadata = {
      recentMessageCount: 0,
      semanticMessageCount: 0,
      subChatCount: 0,
      previousConversationCount: 0,
      estimatedTokens: 0,
      truncated: false,
    };

    // Priority 1: Recent messages (always included)
    const recentMessages = await this.getRecentMessages(
      conversationId,
      CONTEXT_LIMITS.recentMessages
    );
    
    for (const msg of recentMessages) {
      // Skip SubChat summary system messages (they'll be included separately if needed)
      if (msg.role === 'system' && msg.content.includes('[SUBCHAT_SUMMARY]')) {
        continue;
      }
      
      contextMessages.push({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      });
      estimatedTokens += this.estimateTokens(msg.content);
      metadata.recentMessageCount++;
    }

    logger.info('Added recent messages', {
      count: metadata.recentMessageCount,
      tokens: estimatedTokens,
    });

    // Priority 2: Semantically similar messages (if enabled and space available)
    if (includeSemanticSearch && estimatedTokens < maxTokens * 0.5) {
      try {
        const similarMessages = await this.getSemanticallySimilarMessages(
          conversationId,
          currentMessage,
          CONTEXT_LIMITS.semanticSearchResults
        );

        // Filter out messages already in recent context
        const recentIds = new Set(recentMessages.map(m => m.id));
        const uniqueSimilar = similarMessages.filter(m => !recentIds.has(m.id));

        for (const msg of uniqueSimilar) {
          if (estimatedTokens >= maxTokens * 0.6) break;
          
          // Skip SubChat summary system messages
          if (msg.role === 'system' && msg.content.includes('[SUBCHAT_SUMMARY]')) {
            continue;
          }

          contextMessages.push({
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
          });
          estimatedTokens += this.estimateTokens(msg.content);
          metadata.semanticMessageCount++;
        }

        logger.info('Added semantically similar messages', {
          count: metadata.semanticMessageCount,
          tokens: estimatedTokens,
        });
      } catch (error) {
        logger.warn('Failed to get semantically similar messages', { error });
      }
    }

    // Priority 3: SubChat histories (if enabled and space available)
    if (includeSubChats && estimatedTokens < maxTokens * 0.7) {
      try {
        const subChatContext = await this.getSubChatContext(
          conversationId,
          CONTEXT_LIMITS.subChatHistories
        );

        if (subChatContext) {
          const subChatTokens = this.estimateTokens(subChatContext);
          if (estimatedTokens + subChatTokens < maxTokens * 0.8) {
            contextMessages.push({
              role: 'system',
              content: subChatContext,
            });
            estimatedTokens += subChatTokens;
            metadata.subChatCount = CONTEXT_LIMITS.subChatHistories;
          }
        }

        logger.info('Added SubChat context', {
          count: metadata.subChatCount,
          tokens: estimatedTokens,
        });
      } catch (error) {
        logger.warn('Failed to get SubChat context', { error });
      }
    }

    // Priority 4: Previous knowledge (if enabled and space available)
    if (includePreviousKnowledge && estimatedTokens < maxTokens * 0.85) {
      try {
        const previousContext = await this.getPreviousKnowledgeContext(
          conversationId,
          currentMessage,
          CONTEXT_LIMITS.previousConversations
        );

        if (previousContext) {
          const prevTokens = this.estimateTokens(previousContext);
          if (estimatedTokens + prevTokens < maxTokens * 0.95) {
            contextMessages.push({
              role: 'system',
              content: previousContext,
            });
            estimatedTokens += prevTokens;
            metadata.previousConversationCount = CONTEXT_LIMITS.previousConversations;
          }
        }

        logger.info('Added previous knowledge context', {
          count: metadata.previousConversationCount,
          tokens: estimatedTokens,
        });
      } catch (error) {
        logger.warn('Failed to get previous knowledge context', { error });
      }
    }

    metadata.estimatedTokens = estimatedTokens;
    metadata.truncated = estimatedTokens >= maxTokens;

    logger.info('Context building complete', metadata);

    return {
      messages: contextMessages,
      metadata,
    };
  }

  /**
   * Get recent messages from conversation
   */
  private async getRecentMessages(
    conversationId: string,
    limit: number
  ): Promise<any[]> {
    return await Message.find({ conversationId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .then(messages => messages.reverse()); // Return in chronological order
  }

  /**
   * Get semantically similar messages using embeddings
   */
  private async getSemanticallySimilarMessages(
    conversationId: string,
    query: string,
    limit: number
  ): Promise<any[]> {
    try {
      // Generate embedding for the query
      const queryEmbedding = await llmService.createEmbedding(query);

      // Find similar messages
      const similarMessages = await Message.findSimilarMessages(
        conversationId,
        queryEmbedding,
        limit,
        CONTEXT_LIMITS.semanticThreshold
      );

      return similarMessages;
    } catch (error) {
      logger.error('Semantic search failed', { error });
      return [];
    }
  }

  /**
   * Get SubChat context from system messages (MongoDB only - single source of truth)
   */
  private async getSubChatContext(
    conversationId: string,
    limit: number
  ): Promise<string | null> {
    try {
      // Load SubChat summaries from MongoDB system messages
      const subChatMessages = await Message.find({
        conversationId,
        role: 'system',
        content: { $regex: '\\[SUBCHAT_SUMMARY\\]' },
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      if (subChatMessages.length === 0) {
        return null;
      }

      const contextSections = subChatMessages.map((msg, index) => {
        const content = msg.content;
        
        // Parse SubChat data
        const selectedTextMatch = content.match(/Selected Text: "([^"]+)"/);
        const summaryMatch = content.match(/Summary: ([^\n]+)/);
        const detailedMatch = content.match(/Detailed Summary: ([^\n]+(?:\n(?!Full Exchanges:|Question Count:|Merged At:)[^\n]+)*)/);
        
        const selectedText = selectedTextMatch ? selectedTextMatch[1] : 'General discussion';
        const summary = summaryMatch ? summaryMatch[1] : 'Discussion occurred';
        const detailed = detailedMatch ? detailedMatch[1].trim() : summary;

        return `SubChat ${index + 1}: "${selectedText}"
Summary: ${summary}
Details: ${detailed}`;
      });

      return `SUBCHAT CONTEXT: You have ${subChatMessages.length} detailed SubChat discussion(s):

${contextSections.join('\n\n')}

Use this context to provide informed responses about these topics.`;
    } catch (error) {
      logger.error('Failed to get SubChat context', { error });
      return null;
    }
  }

  /**
   * Get previous knowledge context from other conversations
   */
  private async getPreviousKnowledgeContext(
    conversationId: string,
    query: string,
    limit: number
  ): Promise<string | null> {
    try {
      // Get conversation to check user
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return null;
      }

      // Find other conversations by the same user
      const otherConversations = await Conversation.find({
        userId: conversation.userId,
        _id: { $ne: conversationId },
      })
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean();

      if (otherConversations.length === 0) {
        return null;
      }

      const contextSections: string[] = [];

      for (const conv of otherConversations) {
        // Get recent messages from this conversation
        const messages = await Message.find({ conversationId: conv._id })
          .sort({ createdAt: -1 })
          .limit(5)
          .lean();

        if (messages.length === 0) continue;

        const exchanges = messages
          .reverse()
          .filter(m => m.role !== 'system')
          .slice(0, 4) // Max 2 Q&A pairs
          .map(m => `${m.role === 'user' ? 'Q' : 'A'}: ${m.content.substring(0, 200)}${m.content.length > 200 ? '...' : ''}`)
          .join('\n');

        contextSections.push(`Previous Conversation: "${conv.title}"
Date: ${new Date(conv.updatedAt).toLocaleDateString()}
${exchanges}`);
      }

      if (contextSections.length === 0) {
        return null;
      }

      return `PREVIOUS KNOWLEDGE: You have access to ${contextSections.length} previous conversation(s):

${contextSections.join('\n\n---\n\n')}

Use this information to provide contextually aware responses.`;
    } catch (error) {
      logger.error('Failed to get previous knowledge context', { error });
      return null;
    }
  }

  /**
   * Generate and store embedding for a message
   */
  async generateAndStoreEmbedding(messageId: string): Promise<void> {
    try {
      const message = await Message.findById(messageId);
      if (!message) {
        logger.warn('Message not found for embedding generation', { messageId });
        return;
      }

      // Skip system messages and very short messages
      if (message.role === 'system' || message.content.length < 20) {
        return;
      }

      // Generate embedding
      const embedding = await llmService.createEmbedding(message.content);

      // Store embedding
      await Message.updateOne(
        { _id: messageId },
        { $set: { embedding } }
      );

      logger.info('Embedding generated and stored', {
        messageId,
        contentLength: message.content.length,
        embeddingDimensions: embedding.length,
      });
    } catch (error) {
      logger.error('Failed to generate embedding', { error, messageId });
    }
  }

  /**
   * Batch generate embeddings for existing messages
   */
  async batchGenerateEmbeddings(conversationId: string): Promise<void> {
    try {
      // Find messages without embeddings
      const messages = await Message.find({
        conversationId,
        role: { $ne: 'system' },
        embedding: { $exists: false },
      })
        .select('_id content')
        .lean();

      if (messages.length === 0) {
        logger.info('No messages need embeddings', { conversationId });
        return;
      }

      logger.info('Starting batch embedding generation', {
        conversationId,
        messageCount: messages.length,
      });

      // Process in batches to avoid overwhelming the API
      for (let i = 0; i < messages.length; i += CONTEXT_LIMITS.embeddingBatchSize) {
        const batch = messages.slice(i, i + CONTEXT_LIMITS.embeddingBatchSize);
        
        await Promise.all(
          batch.map(msg => this.generateAndStoreEmbedding(msg._id.toString()))
        );

        logger.info('Batch processed', {
          batch: Math.floor(i / CONTEXT_LIMITS.embeddingBatchSize) + 1,
          processed: Math.min(i + CONTEXT_LIMITS.embeddingBatchSize, messages.length),
          total: messages.length,
        });

        // Small delay between batches
        if (i + CONTEXT_LIMITS.embeddingBatchSize < messages.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      logger.info('Batch embedding generation complete', {
        conversationId,
        totalProcessed: messages.length,
      });
    } catch (error) {
      logger.error('Batch embedding generation failed', { error, conversationId });
    }
  }

  /**
   * Estimate token count for text
   */
  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }
}

export const contextService = new ContextService();
