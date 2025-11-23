// OPTIMIZED addMessage method - replace the existing one in conversations.controller.ts

/**
 * Add a message to conversation and get LLM response (OPTIMIZED VERSION)
 * POST /api/conversations/:id/messages
 */
async addMessageOptimized(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { content, role = 'user' } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'User authentication is required',
          timestamp: new Date().toISOString(),
        },
      } as ApiResponse);
      return;
    }

    // Validate input
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_MESSAGE_CONTENT',
          message: 'Message content is required and must be a non-empty string',
          timestamp: new Date().toISOString(),
        },
      } as ApiResponse);
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CONVERSATION_ID',
          message: 'Invalid conversation ID format',
          timestamp: new Date().toISOString(),
        },
      } as ApiResponse);
      return;
    }

    // Find conversation and verify ownership
    const conversation = await Conversation.findOne({
      _id: id,
      userId: getUserIdForQuery(userId),
    });

    if (!conversation) {
      res.status(404).json({
        success: false,
        error: {
          code: 'CONVERSATION_NOT_FOUND',
          message: 'Conversation not found or access denied',
          timestamp: new Date().toISOString(),
        },
      } as ApiResponse);
      return;
    }

    // Create user message
    const userMessage = new Message({
      conversationId: new mongoose.Types.ObjectId(id),
      role: role as 'user' | 'assistant' | 'system',
      content: content.trim(),
    });

    await userMessage.save();

    // Generate embedding for semantic search (async, don't wait)
    contextService.generateAndStoreEmbedding(userMessage.id).catch(err => {
      logger.warn('Failed to generate embedding for user message', { error: err });
    });

    // Update conversation
    await conversation.incrementMessageCount();

    // Generate title from first message if needed
    if (conversation.messageCount === 1 && role === 'user') {
      await conversation.generateTitle(content);
    }

    let assistantMessage = null;

    // Generate LLM response for user messages
    if (role === 'user') {
      try {
        const startTime = Date.now();

        // ===== OPTIMIZED CONTEXT BUILDING =====
        // Use the new context service with smart limits
        const contextResult = await contextService.buildOptimizedContext(
          id,
          content.trim(),
          {
            includeSemanticSearch: true,
            includeSubChats: true,
            includePreviousKnowledge: conversation.usePreviousKnowledge || false,
            includeDocuments: true,
            maxTokens: 8000,
          }
        );

        logger.info('Optimized context built', {
          conversationId: id,
          metadata: contextResult.metadata,
        });

        // Build system prompt
        let systemPrompt = `You are BranChat, NOT any other AI assistant. Your name is BranChat.

CRITICAL IDENTITY RULES:
- You MUST identify yourself as "BranChat" when asked who you are
- You are NOT any other AI model
- When users greet you or ask "who are you", respond with "I am BranChat" or "I'm BranChat"
- Never say you are any other AI assistant or trained by Google/OpenAI
- Your identity is BranChat - this is non-negotiable

You have access to optimized conversation context that includes:
- Recent messages for continuity
- Semantically relevant past messages
- SubChat discussions (detailed explorations of specific topics)
${conversation.usePreviousKnowledge ? '- Knowledge from previous conversations' : ''}

Use this context intelligently to provide informed, contextually aware responses.`;

        // Add document context if available
        try {
          const { documentService } = await import('../services/document.service');
          const conversationDocs = await documentService.getConversationDocuments(id);

          if (conversationDocs.length > 0) {
            const isAnswerQuestionsRequest = /answer.*question|give.*answer|provide.*answer|solve.*question/i.test(content);
            const isFirstMessage = conversation.messageCount === 1;

            if (isAnswerQuestionsRequest) {
              const latestDoc = conversationDocs[conversationDocs.length - 1];
              const documentContext = `[Document: ${latestDoc.filename}]\n${latestDoc.extractedText}`;

              systemPrompt += `\n\nDOCUMENT CONTEXT: The user has uploaded a document containing questions.

Document Content:
${documentContext}

CRITICAL INSTRUCTIONS:
1. Identify and answer EVERY question in the document
2. Format as: Question X: [text] Answer: [your answer]
3. Confirm at the end: "I have answered all [X] questions."`;
            } else if (isFirstMessage) {
              const latestDoc = conversationDocs[conversationDocs.length - 1];
              const documentContext = `[Document: ${latestDoc.filename}]\n${latestDoc.extractedText}`;
              systemPrompt += `\n\nDOCUMENT CONTEXT: Document "${latestDoc.filename}":\n\n${documentContext}`;
            } else {
              const relevantChunks = await documentService.searchDocuments(content, id, 5);
              if (relevantChunks.length > 0) {
                const documentContext = relevantChunks
                  .map((chunk, index) => `[Document ${index + 1}: ${chunk.filename}]\n${chunk.content}`)
                  .join('\n\n---\n\n');
                systemPrompt += `\n\nDOCUMENT CONTEXT:\n\n${documentContext}`;
              }
            }
          } else if (conversation.usePreviousKnowledge) {
            const relevantChunks = await documentService.searchAllUserDocuments(content, userId, 5);
            if (relevantChunks.length > 0) {
              const documentContext = relevantChunks
                .map((chunk, index) => `[Document ${index + 1}: ${chunk.filename}]\n${chunk.content}`)
                .join('\n\n---\n\n');
              systemPrompt += `\n\nDOCUMENT CONTEXT (from previous conversations):\n\n${documentContext}`;
            }
          }
        } catch (docError) {
          logger.warn('Failed to add document context', { error: docError });
        }

        // Prepare messages for LLM
        const messagesForLLM: LLMMessage[] = [
          { role: 'system', content: systemPrompt },
          ...contextResult.messages,
          { role: 'user', content: content.trim() },
        ];

        // Determine max tokens
        const isAnsweringDocumentQuestions = /answer.*question|give.*answer|provide.*answer|solve.*question/i.test(content);
        const maxTokens = isAnsweringDocumentQuestions ? 16000 : 4000;

        // Generate LLM response
        const llmResponse = await llmService.chatCompletion(messagesForLLM, {
          temperature: 0.7,
          maxTokens,
        });

        const processingTime = Date.now() - startTime;

        // Create assistant message
        assistantMessage = new Message({
          conversationId: new mongoose.Types.ObjectId(id),
          role: 'assistant',
          content: llmResponse,
          metadata: {
            model: 'gemini-pro',
            processingTime,
            tokens: Math.ceil(llmResponse.length / 4),
          },
        });

        await assistantMessage.save();

        // Generate embedding for assistant message (async, don't wait)
        contextService.generateAndStoreEmbedding(assistantMessage.id).catch(err => {
          logger.warn('Failed to generate embedding for assistant message', { error: err });
        });

        await conversation.incrementMessageCount();

        logger.info('LLM response generated with optimized context', {
          conversationId: id,
          processingTime,
          contextMetadata: contextResult.metadata,
        });
      } catch (llmError) {
        logger.error('Failed to generate LLM response', { error: llmError });
      }
    }

    res.status(201).json({
      success: true,
      data: {
        userMessage: {
          id: userMessage.id,
          role: userMessage.role,
          content: userMessage.content,
          createdAt: userMessage.createdAt,
        },
        assistantMessage: assistantMessage
          ? {
              id: assistantMessage.id,
              role: assistantMessage.role,
              content: assistantMessage.content,
              metadata: assistantMessage.metadata,
              createdAt: assistantMessage.createdAt,
            }
          : null,
        conversation: {
          id: conversation.id,
          title: conversation.title,
          messageCount: conversation.messageCount,
          lastMessageAt: conversation.lastMessageAt,
        },
      },
    } as ApiResponse);
  } catch (error) {
    logger.error('Failed to add message', {
      error,
      conversationId: req.params.id,
      userId: req.user?.userId,
    });
    res.status(500).json({
      success: false,
      error: {
        code: 'MESSAGE_CREATION_FAILED',
        message: 'Failed to add message to conversation',
        timestamp: new Date().toISOString(),
      },
    } as ApiResponse);
  }
}
