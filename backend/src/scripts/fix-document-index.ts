import mongoose from 'mongoose';
import { config } from '../config/environment';

/**
 * Script to fix the duplicate key error on documents collection
 * Drops the problematic 'id_1' index that was created on a non-existent field
 */
async function fixDocumentIndex() {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await mongoose.connect(config.database.uri);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }

    const collection = db.collection('documents');

    // List all indexes
    console.log('\n📋 Current indexes on documents collection:');
    const indexes = await collection.indexes();
    indexes.forEach((index: any) => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key));
    });

    // Check if the problematic index exists
    const hasIdIndex = indexes.some((index: any) => index.name === 'id_1');

    if (hasIdIndex) {
      console.log('\n🗑️  Dropping problematic "id_1" index...');
      await collection.dropIndex('id_1');
      console.log('✅ Successfully dropped "id_1" index');
    } else {
      console.log('\n✅ No problematic "id_1" index found');
    }

    // List indexes after fix
    console.log('\n📋 Indexes after fix:');
    const updatedIndexes = await collection.indexes();
    updatedIndexes.forEach((index: any) => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key));
    });

    console.log('\n✅ Document index fix completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing document index:', error);
    process.exit(1);
  }
}

// Run the fix
fixDocumentIndex();
