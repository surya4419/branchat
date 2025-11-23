import { Request, Response } from 'express';
import { documentService } from '../services/document.service';
import { logger } from '../utils/logger';

export class DocumentController {
  /**
   * Upload and process document
   */
  async upload(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const userId = req.user?.userId || 'guest';
      
      logger.info('Processing uploaded file', {
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        userId
      });

      const processedDoc = await documentService.processFile(
        req.file.path,
        req.file.originalname,
        userId
      );

      res.json({
        success: true,
        document: {
          id: processedDoc.id,
          filename: processedDoc.filename,
          fileType: processedDoc.fileType,
          totalChunks: processedDoc.totalChunks,
          textLength: processedDoc.extractedText.length,
          processedAt: processedDoc.processedAt
        }
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorDetails = error instanceof Error ? error.stack : String(error);
      
      logger.error('Document upload failed', { 
        error: errorMessage,
        details: errorDetails,
        userId: req.user?.userId,
        filename: req.file?.originalname
      });
      
      res.status(500).json({ 
        error: 'Failed to process document',
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
      });
    }
  }

  /**
   * Search within uploaded documents
   */
  async search(req: Request, res: Response): Promise<void> {
    try {
      const { query, topK = 5 } = req.body;

      if (!query) {
        res.status(400).json({ error: 'Query is required' });
        return;
      }

      const userId = req.user?.userId || 'guest';
      const results = documentService.searchDocuments(query, userId, topK);

      logger.info('Document search completed', {
        userId,
        query,
        resultsCount: results.length
      });

      res.json({
        success: true,
        query,
        results: results.map(chunk => ({
          documentId: chunk.documentId,
          filename: chunk.filename,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          preview: chunk.content.substring(0, 200) + '...'
        })),
        totalResults: results.length
      });

    } catch (error) {
      logger.error('Document search failed', { 
        error, 
        userId: req.user?.userId 
      });
      
      res.status(500).json({ 
        error: 'Failed to search documents',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * List user's documents
   */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId || 'guest';
      const documents = documentService.getUserDocuments(userId);

      res.json({
        success: true,
        documents: documents.map(doc => ({
          id: doc.id,
          filename: doc.filename,
          fileType: doc.fileType,
          totalChunks: doc.totalChunks,
          textLength: doc.extractedText.length,
          processedAt: doc.processedAt
        })),
        totalDocuments: documents.length
      });

    } catch (error) {
      logger.error('Document list failed', { 
        error, 
        userId: req.user?.userId 
      });
      
      res.status(500).json({ 
        error: 'Failed to list documents',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Delete document
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;
      const userId = req.user?.userId || 'guest';

      const deleted = documentService.deleteDocument(documentId, userId);

      if (!deleted) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      res.json({
        success: true,
        message: 'Document deleted successfully'
      });

    } catch (error) {
      logger.error('Document deletion failed', { 
        error, 
        userId: req.user?.userId 
      });
      
      res.status(500).json({ 
        error: 'Failed to delete document',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Clear all documents for current user
   */
  async clear(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId || 'guest';

      documentService.clearUserDocuments(userId);

      res.json({
        success: true,
        message: 'All documents cleared successfully'
      });

    } catch (error) {
      logger.error('Document clear failed', { 
        error, 
        userId: req.user?.userId 
      });
      
      res.status(500).json({ 
        error: 'Failed to clear documents',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const documentController = new DocumentController();
