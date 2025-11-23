/**
 * Migration script to generate embeddings for existing messages
 * Run this once after deploying the embedding feature
 * 
 * Usage: npx ts-node src/scripts/generate-embeddings.ts
 */

import mongoose from 'mongoose';
import { config } from '../config/environment';
import { Conversation } from '../models/Conversation';
import { contextService } from '../services/context.service';
import { logger } from '../utils/logger';

async function generateEmbeddingsForAllConversations() {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.database.uri);
    logger.info('Connected to MongoDB');

    // Get all conversations
    const conversations = await Conversation.find().select('_id title userId');
    logger.info(`Found ${conversations.length} conversations`);

    let processed = 0;
    let failed = 0;

    for (const conversation of conversations) {
      try {
        logger.info(`Processing conversation ${processed + 1}/${conversations.length}`, {
          conversationId: conversation._id,
          title: conversation.title,
        });

        await contextService.batchGenerateEmbeddings(conversation._id.toString());
        processed++;

        logger.info(`✅ Completed conversation ${processed}/${conversations.length}`);

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        failed++;
        logger.error(`❌ Failed to process conversation`, {
          conversationId: conversation._id,
          error,
        });
      }
    }

    logger.info('Migration complete!', {
      total: conversations.length,
      processed,
      failed,
    });

    // Disconnect
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');

    process.exit(0);
  } catch (error) {
    logger.error('Migration failed', { error });
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  generateEmbeddingsForAllConversations();
}

export { generateEmbeddingsForAllConversations };
