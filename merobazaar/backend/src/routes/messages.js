import { Router } from 'express';
import { Message, Conversation } from '../models/Message.js';
import { protect } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';

const router = Router();

router.use(protect);

// GET all conversations for current user
router.get('/conversations', async (req, res) => {
  const conversations = await Conversation.find({
    participants: req.user._id,
  })
    .sort('-lastMessageAt')
    .populate('participants', 'name avatar')
    .populate('product', 'name images')
    .limit(30);

  res.json({ success: true, data: conversations });
});

// GET or create conversation with another user
router.post('/conversations', async (req, res, next) => {
  const { recipientId, productId } = req.body;
  if (!recipientId) return next(new AppError('recipientId required.', 400));

  let conversation = await Conversation.findOne({
    participants: { $all: [req.user._id, recipientId] },
    ...(productId && { product: productId }),
  });

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [req.user._id, recipientId],
      product: productId || null,
    });
  }

  await conversation.populate('participants', 'name avatar');
  res.json({ success: true, data: conversation });
});

// GET messages for a conversation
router.get('/conversations/:convId/messages', async (req, res, next) => {
  const conversation = await Conversation.findById(req.params.convId);
  if (!conversation) return next(new AppError('Conversation not found.', 404));

  // Ensure user is a participant
  if (!conversation.participants.some((p) => p.toString() === req.user._id.toString())) {
    return next(new AppError('Not authorized.', 403));
  }

  const page = parseInt(req.query.page) || 1;
  const limit = 50;

  const messages = await Message.find({ conversation: req.params.convId })
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('sender', 'name avatar');

  // Mark messages from others as read
  await Message.updateMany(
    { conversation: req.params.convId, sender: { $ne: req.user._id }, isRead: false },
    { isRead: true, readAt: new Date() }
  );

  res.json({ success: true, data: messages.reverse() });
});

export default router;
