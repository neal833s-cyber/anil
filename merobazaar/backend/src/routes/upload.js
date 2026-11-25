import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { upload, uploadToCloudinary, deleteFromCloudinary } from '../middleware/upload.js';
import { AppError } from '../middleware/error.js';

const router = Router();

router.use(protect);

router.post('/', upload.array('files', 10), async (req, res, next) => {
  if (!req.files?.length) return next(new AppError('No files uploaded.', 400));

  const folder = req.body.folder || 'general';

  const results = await Promise.all(
    req.files.map((file) => uploadToCloudinary(file.buffer, folder))
  );

  res.json({ success: true, data: results });
});

router.delete('/', async (req, res, next) => {
  const { publicId } = req.body;
  if (!publicId) return next(new AppError('public_id required.', 400));
  await deleteFromCloudinary(publicId);
  res.json({ success: true, message: 'File deleted.' });
});

export default router;
