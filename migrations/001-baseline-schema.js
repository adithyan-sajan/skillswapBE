// Baseline schema migration: creates every collection used by the app
// with a $jsonSchema validator derived from models/*.js.
//
// Validator strategy:
// - Required fields mirror `required: true` in each Mongoose schema.
// - Enums mirror the `enum` arrays in each Mongoose schema.
// - Numeric fields validate against bsonType 'number' (matches any BSON
//   numeric type) because Mongoose stores JS numbers as doubles/ints.
// - Models declared with `{ timestamps: true }` get createdAt/updatedAt.
//
// Note: migrate-mongo manages its own `changelog` collection; it is NOT
// created or dropped here.

module.exports = {
  async up(db) {
    const createIfMissing = async (name, options = {}) => {
      const exists = await db.listCollections({ name }).hasNext();
      if (!exists) {
        await db.createCollection(name, options);
      }
    };

    // --- users (models/User.js) ---
    await createIfMissing('users', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['username', 'email', 'passwordHash'],
          properties: {
            username: { bsonType: 'string', description: 'must be a string and is required' },
            email: { bsonType: 'string', description: 'must be a string and is required' },
            passwordHash: { bsonType: 'string', description: 'must be a string and is required' },
            role: {
              bsonType: 'string',
              enum: ['member', 'admin'],
              description: 'must be either member or admin'
            },
            walletBalance: { bsonType: 'number', description: 'must be a number' },
            avatarUrl: { bsonType: 'string', description: 'must be a string' },
            bio: {
              bsonType: 'string',
              maxLength: 250,
              description: 'must be a string with max length 250'
            },
            location: { bsonType: 'string', description: 'must be a string' },
            website: { bsonType: 'string', description: 'must be a string' },
            socials: {
              bsonType: 'object',
              properties: {
                github: { bsonType: 'string' },
                linkedin: { bsonType: 'string' },
                twitter: { bsonType: 'string' }
              }
            },
            skillsOffered: { bsonType: 'array', items: { bsonType: 'string' } },
            skillsDesired: { bsonType: 'array', items: { bsonType: 'string' } },
            rating: { bsonType: 'number', description: 'must be a number' },
            totalSessionsCompleted: { bsonType: 'number', description: 'must be a number' },
            hoursTaught: { bsonType: 'number', description: 'must be a number' },
            hoursLearned: { bsonType: 'number', description: 'must be a number' },
            rank: { bsonType: 'string', description: 'must be a string' },
            createdAt: { bsonType: 'date' }
          }
        }
      }
    });
    await db.collection('users').createIndex({ username: 1 }, { unique: true });
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ role: 1 });

    // --- skilllistings (models/SkillListing.js) ---
    await createIfMissing('skilllistings', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['hostId', 'title', 'category', 'description', 'level', 'costPerHour'],
          properties: {
            hostId: { bsonType: 'objectId', description: 'must be an objectId and is required' },
            title: { bsonType: 'string', description: 'must be a string and is required' },
            category: {
              bsonType: 'string',
              enum: ['languages', 'tech', 'creative', 'business', 'misc'],
              description: 'must be one of the enum values and is required'
            },
            description: { bsonType: 'string', description: 'must be a string and is required' },
            level: {
              bsonType: 'string',
              enum: ['Beginner', 'Intermediate', 'Advanced'],
              description: 'must be one of the enum values and is required'
            },
            costPerHour: {
              bsonType: 'number',
              minimum: 0.1,
              description: 'must be a number >= 0.1 and is required'
            },
            isActive: { bsonType: 'bool', description: 'must be a boolean' },
            createdAt: { bsonType: 'date' }
          }
        }
      }
    });
    await db.collection('skilllistings').createIndex({ hostId: 1 });
    await db.collection('skilllistings').createIndex({ category: 1 });
    await db.collection('skilllistings').createIndex({ level: 1 });
    await db.collection('skilllistings').createIndex({ isActive: 1 });

    // --- swaprequests (models/SwapRequest.js, timestamps: true) ---
    await createIfMissing('swaprequests', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['senderId', 'receiverId', 'listingId'],
          properties: {
            senderId: { bsonType: 'objectId', description: 'must be an objectId and is required' },
            receiverId: { bsonType: 'objectId', description: 'must be an objectId and is required' },
            listingId: { bsonType: 'objectId', description: 'must be an objectId and is required' },
            status: {
              bsonType: 'string',
              enum: ['Pending', 'Accepted', 'Rejected', 'Completed'],
              description: 'must be one of the enum values'
            },
            message: {
              bsonType: 'string',
              maxLength: 500,
              description: 'must be a string with max length 500'
            },
            createdAt: { bsonType: 'date' },
            updatedAt: { bsonType: 'date' }
          }
        }
      }
    });
    await db.collection('swaprequests').createIndex({ senderId: 1 });
    await db.collection('swaprequests').createIndex({ receiverId: 1 });
    await db.collection('swaprequests').createIndex({ listingId: 1 });
    await db.collection('swaprequests').createIndex({ status: 1 });

    // --- traderequests (models/TradeRequest.js) ---
    await createIfMissing('traderequests', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['skillListingId', 'hostId', 'seekerId'],
          properties: {
            skillListingId: { bsonType: 'objectId', description: 'must be an objectId and is required' },
            hostId: { bsonType: 'objectId', description: 'must be an objectId and is required' },
            seekerId: { bsonType: 'objectId', description: 'must be an objectId and is required' },
            status: {
              bsonType: 'string',
              enum: ['pending', 'accepted', 'rejected', 'completed'],
              description: 'must be one of the enum values'
            },
            message: {
              bsonType: 'string',
              maxLength: 500,
              description: 'must be a string with max length 500'
            },
            createdAt: { bsonType: 'date' }
          }
        }
      }
    });
    await db.collection('traderequests').createIndex({ skillListingId: 1 });
    await db.collection('traderequests').createIndex({ hostId: 1 });
    await db.collection('traderequests').createIndex({ seekerId: 1 });
    await db.collection('traderequests').createIndex({ status: 1 });

    // --- sessions (models/Session.js) ---
    await createIfMissing('sessions', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['skillId', 'hostId', 'learnerId', 'escrowAmount'],
          properties: {
            skillId: { bsonType: 'objectId', description: 'must be an objectId and is required' },
            hostId: { bsonType: 'objectId', description: 'must be an objectId and is required' },
            learnerId: { bsonType: 'objectId', description: 'must be an objectId and is required' },
            hostCompleted: { bsonType: 'bool', description: 'must be a boolean' },
            learnerCompleted: { bsonType: 'bool', description: 'must be a boolean' },
            disputeReason: { bsonType: 'string', description: 'must be a string' },
            escrowAmount: { bsonType: 'number', description: 'must be a number and is required' },
            status: {
              bsonType: 'string',
              enum: ['pending', 'active', 'completed', 'disputed', 'cancelled'],
              description: 'must be one of the enum values'
            },
            scheduledStartTime: { bsonType: 'date' },
            roomId: { bsonType: 'string', description: 'must be a string' },
            createdAt: { bsonType: 'date' }
          }
        }
      }
    });
    await db.collection('sessions').createIndex({ skillId: 1 });
    await db.collection('sessions').createIndex({ hostId: 1 });
    await db.collection('sessions').createIndex({ learnerId: 1 });
    await db.collection('sessions').createIndex({ status: 1 });
    await db.collection('sessions').createIndex({ roomId: 1 }, { unique: true });

    // --- conversations (models/Conversation.js, timestamps: true) ---
    await createIfMissing('conversations', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['participants'],
          properties: {
            participants: {
              bsonType: 'array',
              items: { bsonType: 'objectId' },
              minItems: 2,
              description: 'must be an array of objectIds and is required'
            },
            listingId: { bsonType: 'objectId', description: 'must be an objectId' },
            lastMessage: { bsonType: 'objectId', description: 'must be an objectId' },
            createdAt: { bsonType: 'date' },
            updatedAt: { bsonType: 'date' }
          }
        }
      }
    });
    await db.collection('conversations').createIndex({ participants: 1 });
    await db.collection('conversations').createIndex({ listingId: 1 });
    await db.collection('conversations').createIndex({ lastMessage: 1 });

    // --- messages (models/Message.js, timestamps: true) ---
    await createIfMissing('messages', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['conversationId', 'senderId', 'text'],
          properties: {
            conversationId: { bsonType: 'objectId', description: 'must be an objectId and is required' },
            senderId: { bsonType: 'objectId', description: 'must be an objectId and is required' },
            text: { bsonType: 'string', description: 'must be a string and is required' },
            isRead: { bsonType: 'bool', description: 'must be a boolean' },
            createdAt: { bsonType: 'date' },
            updatedAt: { bsonType: 'date' }
          }
        }
      }
    });
    await db.collection('messages').createIndex({ conversationId: 1 });
    await db.collection('messages').createIndex({ senderId: 1 });
    await db.collection('messages').createIndex({ isRead: 1 });
    await db.collection('messages').createIndex({ createdAt: -1 }); // For sorting newest first
  },

  async down(db) {
    // Drop the app collections this migration creates, in reverse dependency order.
    // migrate-mongo's own changelog collection is left untouched.
    await db.collection('messages').drop();
    await db.collection('conversations').drop();
    await db.collection('sessions').drop();
    await db.collection('traderequests').drop();
    await db.collection('swaprequests').drop();
    await db.collection('skilllistings').drop();
    await db.collection('users').drop();
  }
};
