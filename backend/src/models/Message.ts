import mongoose, { Document, Schema } from 'mongoose';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface IMessage extends Document {
  _id: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  role: MessageRole;
  content: string;
  embedding?: number[]; // Semantic search support
  metadata?: {
    tokens?: number;
    model?: string;
    temperature?: number;
    processingTime?: number;
    fromSubchat?: boolean;
    subchatId?: mongoose.Types.ObjectId;
    memoryUsed?: boolean;
    memoryCount?: number;
  };
  createdAt: Date;
  updatedAt: Date;
  
  // Virtual properties
  id: string;
  
  // Instance methods
  isFromUser(): boolean;
  isFromAssistant(): boolean;
  isFromSubchat(): boolean;
  getTokenCount(): number;
}

export interface IMessageModel extends mongoose.Model<IMessage> {
  findByConversationId(conversationId: string, options?: any): Promise<IMessage[]>;
  getConversationHistory(conversationId: string, limit?: number): Promise<any[]>;
  getTokenUsage(conversationId: string, startDate?: Date, endDate?: Date): Promise<any[]>;
  findSimilarMessages(conversationId: string, queryEmbedding: number[], limit?: number, threshold?: number): Promise<IMessage[]>;
}

const messageSchema = new Schema<IMessage>({
  conversationId: {
    type: Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true,
  },
  
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true,
  },
  
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50000, // Reasonable limit for message content
  },
  
  embedding: {
    type: [Number],
    select: false, // Don't include by default to save bandwidth
  },
  
  metadata: {
    tokens: {
      type: Number,
      min: 0,
    },
    model: {
      type: String,
      trim: true,
    },
    temperature: {
      type: Number,
      min: 0,
      max: 2,
    },
    processingTime: {
      type: Number,
      min: 0,
    },
    fromSubchat: {
      type: Boolean,
      default: false,
    },
    subchatId: {
      type: Schema.Types.ObjectId,
      ref: 'Subchat',
    },
    memoryUsed: {
      type: Boolean,
      default: false,
    },
    memoryCount: {
      type: Number,
      min: 0,
    },
  },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(_doc, ret: any) {
      delete ret._id;
      delete ret.__v;
      delete ret.embedding; // Never expose embeddings in JSON
      return ret;
    }
  },
  toObject: {
    virtuals: true,
  }
});

// Indexes
messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ conversationId: 1, role: 1 });
messageSchema.index({ 'metadata.subchatId': 1 });
messageSchema.index({ createdAt: -1 });
messageSchema.index({ conversationId: 1, embedding: 1 }); // For semantic search

// Virtual for id
messageSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Instance methods
messageSchema.methods.isFromUser = function() {
  return this.role === 'user';
};

messageSchema.methods.isFromAssistant = function() {
  return this.role === 'assistant';
};

messageSchema.methods.isFromSubchat = function() {
  return this.metadata?.fromSubchat === true;
};

messageSchema.methods.getTokenCount = function() {
  return this.metadata?.tokens || 0;
};

// Static methods
messageSchema.statics.findByConversationId = function(
  conversationId: string,
  options: {
    page?: number;
    limit?: number;
    sortOrder?: 'asc' | 'desc';
    role?: MessageRole;
  } = {}
) {
  const {
    page = 1,
    limit = 50,
    sortOrder = 'asc',
    role
  } = options;
  
  const skip = (page - 1) * limit;
  const sort = { createdAt: sortOrder === 'desc' ? -1 : 1 };
  
  const query: any = { conversationId };
  if (role) {
    query.role = role;
  }
  
  return this.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit);
};

messageSchema.statics.getConversationHistory = function(
  conversationId: string,
  limit: number = 20
) {
  return this.find({ conversationId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('role content metadata.tokens metadata.model createdAt')
    .lean();
};

messageSchema.statics.getTokenUsage = function(
  conversationId: string,
  startDate?: Date,
  endDate?: Date
) {
  const match: any = { conversationId };
  
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = startDate;
    if (endDate) match.createdAt.$lte = endDate;
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$role',
        totalTokens: { $sum: '$metadata.tokens' },
        messageCount: { $sum: 1 },
      }
    }
  ]);
};

// Semantic search using cosine similarity
messageSchema.statics.findSimilarMessages = async function(
  conversationId: string,
  queryEmbedding: number[],
  limit: number = 5,
  threshold: number = 0.7
): Promise<IMessage[]> {
  // Find messages with embeddings
  const messages = await this.find({
    conversationId,
    embedding: { $exists: true, $ne: null }
  })
  .select('+embedding')
  .lean();

  if (messages.length === 0) {
    return [];
  }

  // Calculate cosine similarity for each message
  interface MessageWithScore {
    _id: mongoose.Types.ObjectId;
    conversationId: mongoose.Types.ObjectId;
    role: MessageRole;
    content: string;
    embedding: number[];
    similarity: number;
    createdAt: Date;
    updatedAt: Date;
  }

  const messagesWithScores: MessageWithScore[] = messages.map((msg: any) => {
    const similarity = cosineSimilarity(queryEmbedding, msg.embedding);
    return { ...msg, similarity };
  });

  // Filter by threshold and sort by similarity
  const relevantMessages = messagesWithScores
    .filter((msg: MessageWithScore) => msg.similarity >= threshold)
    .sort((a: MessageWithScore, b: MessageWithScore) => b.similarity - a.similarity)
    .slice(0, limit);

  return relevantMessages as any;
};

// Helper function for cosine similarity
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

// Pre-save middleware
messageSchema.pre('save', function(next) {
  // Ensure system messages don't have subchat metadata
  if (this.role === 'system' && this.metadata?.fromSubchat) {
    this.metadata.fromSubchat = false;
    this.metadata.subchatId = undefined;
  }
  
  next();
});

export const Message = mongoose.model<IMessage, IMessageModel>('Message', messageSchema);