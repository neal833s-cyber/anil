import { verifyAccessToken } from '../utils/jwt.js';
import { Message, Conversation } from '../models/Message.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { logger } from '../utils/logger.js';

const onlineUsers = new Map(); // userId -> socketId

export const initSocket = (io) => {
  // Auth middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.id).select('name avatar role');
      if (!user) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.user.name} (${socket.id})`);

    // Join personal room for notifications
    socket.join(`user:${socket.user._id}`);
    onlineUsers.set(socket.user._id.toString(), socket.id);

    // Broadcast online status
    io.emit('user:online', { userId: socket.user._id });

    // Get online users
    socket.on('users:online', () => {
      socket.emit('users:online', Array.from(onlineUsers.keys()));
    });

    // Join conversation
    socket.on('conversation:join', async (conversationId) => {
      socket.join(`conv:${conversationId}`);
    });

    // Leave conversation
    socket.on('conversation:leave', (conversationId) => {
      socket.leave(`conv:${conversationId}`);
    });

    // Send message
    socket.on('message:send', async (data) => {
      try {
        const { conversationId, content, type = 'text', fileUrl } = data;

        // Find or create conversation
        let conversation;
        if (conversationId) {
          conversation = await Conversation.findById(conversationId);
        } else if (data.recipientId) {
          conversation = await Conversation.findOne({
            participants: { $all: [socket.user._id, data.recipientId] },
          });

          if (!conversation) {
            conversation = await Conversation.create({
              participants: [socket.user._id, data.recipientId],
              product: data.productId,
            });
          }
        }

        if (!conversation) return socket.emit('error', { message: 'Conversation not found' });

        const message = await Message.create({
          conversation: conversation._id,
          sender: socket.user._id,
          content,
          type,
          fileUrl,
        });

        await message.populate('sender', 'name avatar');

        // Update conversation last message
        await Conversation.findByIdAndUpdate(conversation._id, {
          lastMessage: content,
          lastMessageAt: new Date(),
        });

        // Emit to all in conversation
        io.to(`conv:${conversation._id}`).emit('message:receive', {
          ...message.toObject(),
          conversation: conversation._id,
        });

        // Notify other participants
        const otherParticipants = conversation.participants.filter(
          (p) => p.toString() !== socket.user._id.toString()
        );

        for (const participantId of otherParticipants) {
          const recipientSocketId = onlineUsers.get(participantId.toString());

          if (recipientSocketId) {
            io.to(`user:${participantId}`).emit('message:new', {
              conversationId: conversation._id,
              sender: { _id: socket.user._id, name: socket.user.name, avatar: socket.user.avatar },
              content,
              createdAt: message.createdAt,
            });
          } else {
            // User offline — create notification
            await Notification.create({
              user: participantId,
              type: 'message',
              title: `New message from ${socket.user.name}`,
              message: content.substring(0, 80),
              link: `/messages/${conversation._id}`,
            });
          }
        }
      } catch (error) {
        logger.error(`Socket message error: ${error.message}`);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Mark messages as read
    socket.on('message:read', async (conversationId) => {
      await Message.updateMany(
        { conversation: conversationId, sender: { $ne: socket.user._id }, isRead: false },
        { isRead: true, readAt: new Date() }
      );
      socket.to(`conv:${conversationId}`).emit('message:read', { conversationId, userId: socket.user._id });
    });

    // Typing indicator
    socket.on('typing:start', (conversationId) => {
      socket.to(`conv:${conversationId}`).emit('typing:start', {
        conversationId,
        user: { _id: socket.user._id, name: socket.user.name },
      });
    });

    socket.on('typing:stop', (conversationId) => {
      socket.to(`conv:${conversationId}`).emit('typing:stop', {
        conversationId,
        userId: socket.user._id,
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      onlineUsers.delete(socket.user._id.toString());
      io.emit('user:offline', { userId: socket.user._id });
      logger.info(`Socket disconnected: ${socket.user.name}`);
    });
  });
};
