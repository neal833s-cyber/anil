import { Router } from 'express';
import Notification from '../models/Notification.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 20;

  const [notifications, unreadCount, total] = await Promise.all([
    Notification.find({ user: req.user._id })
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit),
    Notification.countDocuments({ user: req.user._id, isRead: false }),
    Notification.countDocuments({ user: req.user._id }),
  ]);

  res.json({ success: true, data: notifications, unreadCount, total, page });
});

router.put('/read-all', async (req, res) => {
  await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
  res.json({ success: true, message: 'All notifications marked as read.' });
});

router.put('/:id/read', async (req, res) => {
  await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { isRead: true });
  res.json({ success: true });
});

router.delete('/:id', async (req, res) => {
  await Notification.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  res.json({ success: true });
});

export default router;
