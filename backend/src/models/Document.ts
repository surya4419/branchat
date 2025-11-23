import mongoose, { Document, Schema } from 'mongoose';

export interface IDocument extends Document {
  _id: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId | string;
  filename: string;
  fileType: string;
  extractedText: string;
  chunks: Array<{
    id: string;
    chunkIndex: number;
    content: string;
    pageNumber?: number;
  }>;
  totalChunks: number;
  createdAt: Date;
  updatedAt: Date;
  
  // Virtual properties
  id: string;
}

const documentSchema = new Schema<IDocument>({
  conversationId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'Conversation',
    index: true,
  },
  
  userId: {
    type: Schema.Types.Mixed, // Allow both ObjectId and string for guest users
    required: true,
    index: true,
  },
  
  filename: {
    type: String,
    required: true,
    trim: true,
  },
  
  fileType: {
    type: String,
    required: true,
    enum: ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.bmp'],
  },
  
  extractedText: {
    type: String,
    required: true,
  },
  
  chunks: [{
    id: {
      type: String,
      required: true,
    },
    chunkIndex: {
      type: Number,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    pageNumber: {
      type: Number,
    },
  }],
  
  totalChunks: {
    type: Number,
    required: true,
    min: 0,
  },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(_doc, ret: any) {
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    virtuals: true,
  }
});

// Indexes
documentSchema.index({ conversationId: 1, createdAt: -1 });
documentSchema.index({ userId: 1, conversationId: 1 });

// Virtual for id
documentSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Static methods
documentSchema.statics.findByConversationId = function(conversationId: string) {
  return this.find({ conversationId: new mongoose.Types.ObjectId(conversationId) })
    .sort({ createdAt: -1 });
};

documentSchema.statics.findByUserId = function(userId: string) {
  const userIdQuery = userId.startsWith('guest_') ? userId : new mongoose.Types.ObjectId(userId);
  return this.find({ userId: userIdQuery })
    .sort({ createdAt: -1 });
};

export interface IDocumentModel extends mongoose.Model<IDocument> {
  findByConversationId(conversationId: string): Promise<IDocument[]>;
  findByUserId(userId: string): Promise<IDocument[]>;
}

export const DocumentModel = mongoose.model<IDocument, IDocumentModel>('Document', documentSchema);
