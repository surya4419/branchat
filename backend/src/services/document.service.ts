import * as fs from 'fs-extra';
import * as path from 'path';
import Tesseract from 'tesseract.js';
import ShortUniqueId from 'short-unique-id';
import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import { DocumentModel } from '../models/Document';

// Import pdf-parse v2 API
const { PDFParse } = require('pdf-parse');

const uid = new ShortUniqueId({ length: 10 });

export interface DocumentChunk {
  id: string;
  documentId: string;
  filename: string;
  chunkIndex: number;
  content: string;
  pageNumber?: number;
  createdAt: string;
}

export interface ProcessedDocument {
  id: string;
  filename: string;
  fileType: string;
  chunks: DocumentChunk[];
  totalChunks: number;
  extractedText: string;
  processedAt: string;
}

class DocumentService {
  private uploadsDir = path.join(__dirname, '../../uploads');

  constructor() {
    // Ensure uploads directory exists
    fs.ensureDirSync(this.uploadsDir);
  }

  /**
   * Extract text from PDF
   */
  async extractTextFromPDF(filePath: string): Promise<string> {
    try {
      logger.info('Starting PDF extraction', { filePath });
      
      // Read the PDF file
      const dataBuffer = await fs.readFile(filePath);
      logger.info('PDF file read successfully', { size: dataBuffer.length });
      
      // Create PDF parser instance with data
      const parser = new PDFParse({ 
        verbosity: 0,
        data: dataBuffer
      });
      
      // Load the PDF
      await parser.load();
      logger.info('PDF loaded successfully');
      
      // Extract text from all pages
      const result = await parser.getText();
      logger.info('PDF text extracted successfully', { 
        resultType: typeof result,
        hasText: result && typeof result === 'object' && 'text' in result
      });
      
      // The result is an object with a text property
      const text = typeof result === 'object' && result !== null && 'text' in result 
        ? (result as any).text 
        : String(result || '');
      
      logger.info('Final text length:', text.length);
      
      // Clean up
      await parser.destroy();
      
      return text || '';
    } catch (error) {
      logger.error('PDF extraction error', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        filePath 
      });
      throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract text from image using OCR
   */
  async extractTextFromImage(filePath: string): Promise<string> {
    try {
      const { data: { text } } = await Tesseract.recognize(filePath, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            logger.info(`OCR progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      return text;
    } catch (error) {
      logger.error('OCR extraction error', { error, filePath });
      throw new Error('Failed to extract text from image');
    }
  }

  /**
   * Chunk text into manageable pieces
   */
  chunkText(text: string, chunkSize: number = 1000): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/[.!?]+\s+/);
    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? '. ' : '') + sentence;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Process uploaded file and associate with conversation
   */
  async processFile(
    filePath: string,
    filename: string,
    userId: string,
    conversationId: string
  ): Promise<ProcessedDocument> {
    try {
      const fileExt = path.extname(filename).toLowerCase();
      let extractedText = '';

      // Extract text based on file type
      if (fileExt === '.pdf') {
        extractedText = await this.extractTextFromPDF(filePath);
        
        // If PDF text is empty, it might be scanned - try OCR
        if (!extractedText.trim()) {
          logger.info('PDF appears to be scanned, attempting OCR');
          extractedText = await this.extractTextFromImage(filePath);
        }
      } else if (['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(fileExt)) {
        extractedText = await this.extractTextFromImage(filePath);
      } else {
        throw new Error(`Unsupported file type: ${fileExt}`);
      }

      // Clean text
      extractedText = extractedText
        .replace(/\s+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      if (!extractedText) {
        throw new Error('No text could be extracted from the file');
      }

      // Chunk the text
      const textChunks = this.chunkText(extractedText, 1000);
      const documentId = uid.rnd();

      // Create document chunks
      const chunks = textChunks.map((content, index) => ({
        id: `${documentId}_chunk_${index}`,
        chunkIndex: index,
        content,
      }));

      // Save to MongoDB associated with conversation
      const userIdValue = userId.startsWith('guest_') ? userId : new mongoose.Types.ObjectId(userId);
      
      const document = new DocumentModel({
        conversationId: new mongoose.Types.ObjectId(conversationId),
        userId: userIdValue,
        filename,
        fileType: fileExt,
        extractedText,
        chunks,
        totalChunks: chunks.length,
      });

      await document.save();

      // Clean up uploaded file
      await fs.remove(filePath);

      logger.info('Document processed and saved to MongoDB', {
        documentId: document.id,
        conversationId,
        filename,
        chunks: chunks.length,
        textLength: extractedText.length
      });

      // Return in the expected format
      const processedDoc: ProcessedDocument = {
        id: document.id,
        filename: document.filename,
        fileType: document.fileType,
        chunks: document.chunks.map(c => ({
          ...c,
          documentId: document.id,
          filename: document.filename,
          createdAt: document.createdAt.toISOString(),
        })),
        totalChunks: document.totalChunks,
        extractedText: document.extractedText,
        processedAt: document.createdAt.toISOString(),
      };

      return processedDoc;
    } catch (error) {
      // Clean up file on error
      await fs.remove(filePath).catch(() => {});
      throw error;
    }
  }

  /**
   * Search documents using simple keyword matching
   * Only searches within a specific conversation
   */
  async searchDocuments(query: string, conversationId: string, topK: number = 5): Promise<DocumentChunk[]> {
    try {
      const documents = await DocumentModel.findByConversationId(conversationId);
      const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
      
      const scoredChunks: Array<{ chunk: DocumentChunk; score: number }> = [];

      for (const doc of documents) {
        for (const chunk of doc.chunks) {
          const content = chunk.content.toLowerCase();
          let score = 0;

          // Count keyword matches
          for (const keyword of keywords) {
            const matches = (content.match(new RegExp(keyword, 'g')) || []).length;
            score += matches;
          }

          if (score > 0) {
            scoredChunks.push({ 
              chunk: {
                id: chunk.id,
                documentId: doc.id,
                filename: doc.filename,
                chunkIndex: chunk.chunkIndex,
                content: chunk.content,
                pageNumber: chunk.pageNumber,
                createdAt: doc.createdAt.toISOString(),
              }, 
              score 
            });
          }
        }
      }

      // Sort by score and return top K
      return scoredChunks
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map(item => item.chunk);
    } catch (error) {
      logger.error('Document search error', { error, conversationId });
      return [];
    }
  }

  /**
   * Search documents across all user's conversations (for "use previous knowledge")
   */
  async searchAllUserDocuments(query: string, userId: string, topK: number = 5): Promise<DocumentChunk[]> {
    try {
      const documents = await DocumentModel.findByUserId(userId);
      const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
      
      const scoredChunks: Array<{ chunk: DocumentChunk; score: number }> = [];

      for (const doc of documents) {
        for (const chunk of doc.chunks) {
          const content = chunk.content.toLowerCase();
          let score = 0;

          // Count keyword matches
          for (const keyword of keywords) {
            const matches = (content.match(new RegExp(keyword, 'g')) || []).length;
            score += matches;
          }

          if (score > 0) {
            scoredChunks.push({ 
              chunk: {
                id: chunk.id,
                documentId: doc.id,
                filename: doc.filename,
                chunkIndex: chunk.chunkIndex,
                content: chunk.content,
                pageNumber: chunk.pageNumber,
                createdAt: doc.createdAt.toISOString(),
              }, 
              score 
            });
          }
        }
      }

      // Sort by score and return top K
      return scoredChunks
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map(item => item.chunk);
    } catch (error) {
      logger.error('User documents search error', { error, userId });
      return [];
    }
  }

  /**
   * Get documents for a specific conversation
   */
  async getConversationDocuments(conversationId: string): Promise<ProcessedDocument[]> {
    try {
      const documents = await DocumentModel.findByConversationId(conversationId);
      
      return documents.map(doc => ({
        id: doc.id,
        filename: doc.filename,
        fileType: doc.fileType,
        chunks: doc.chunks.map(c => ({
          id: c.id,
          documentId: doc.id,
          filename: doc.filename,
          chunkIndex: c.chunkIndex,
          content: c.content,
          pageNumber: c.pageNumber,
          createdAt: doc.createdAt.toISOString(),
        })),
        totalChunks: doc.totalChunks,
        extractedText: doc.extractedText,
        processedAt: doc.createdAt.toISOString(),
      }));
    } catch (error) {
      logger.error('Get conversation documents error', { error, conversationId });
      return [];
    }
  }

  /**
   * Get all user's documents (across all conversations)
   */
  async getUserDocuments(userId: string): Promise<ProcessedDocument[]> {
    try {
      const documents = await DocumentModel.findByUserId(userId);
      
      return documents.map(doc => ({
        id: doc.id,
        filename: doc.filename,
        fileType: doc.fileType,
        chunks: doc.chunks.map(c => ({
          id: c.id,
          documentId: doc.id,
          filename: doc.filename,
          chunkIndex: c.chunkIndex,
          content: c.content,
          pageNumber: c.pageNumber,
          createdAt: doc.createdAt.toISOString(),
        })),
        totalChunks: doc.totalChunks,
        extractedText: doc.extractedText,
        processedAt: doc.createdAt.toISOString(),
      }));
    } catch (error) {
      logger.error('Get user documents error', { error, userId });
      return [];
    }
  }

  /**
   * Delete document
   */
  async deleteDocument(documentId: string, userId: string): Promise<boolean> {
    try {
      const userIdValue = userId.startsWith('guest_') ? userId : new mongoose.Types.ObjectId(userId);
      const result = await DocumentModel.deleteOne({
        _id: new mongoose.Types.ObjectId(documentId),
        userId: userIdValue,
      });

      logger.info('Document deleted', { documentId, userId, deleted: result.deletedCount });
      return result.deletedCount > 0;
    } catch (error) {
      logger.error('Delete document error', { error, documentId, userId });
      return false;
    }
  }

  /**
   * Clear all documents for a conversation
   */
  async clearConversationDocuments(conversationId: string): Promise<void> {
    try {
      const result = await DocumentModel.deleteMany({
        conversationId: new mongoose.Types.ObjectId(conversationId),
      });
      
      logger.info('Cleared all documents for conversation', { conversationId, count: result.deletedCount });
    } catch (error) {
      logger.error('Clear conversation documents error', { error, conversationId });
    }
  }
}

export const documentService = new DocumentService();
