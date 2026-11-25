import Stripe from 'stripe';
import crypto from 'crypto';
import Order from '../models/Order.js';
import { AppError } from '../middleware/error.js';
import { logger } from '../utils/logger.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

// ─── eSewa v2 helpers ───────────────────────────────────────────────────────

const ESEWA_SANDBOX_URL = 'https://rc-epay.esewa.com.np/api/epay/main/v2/form';
const ESEWA_PRODUCTION_URL = 'https://epay.esewa.com.np/api/epay/main/v2/form';
const ESEWA_STATUS_SANDBOX = 'https://rc.esewa.com.np/api/epay/transaction/status/';
const ESEWA_STATUS_PRODUCTION = 'https://esewa.com.np/api/epay/transaction/status/';

/**
 * Generate HMAC-SHA256 signature required by eSewa v2
 * Message format: "total_amount=X,transaction_uuid=Y,product_code=Z"
 */
function generateEsewaSignature(totalAmount, transactionUuid, productCode, secretKey) {
  const message = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`;
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(message);
  return hmac.digest('base64');
}

/** Build a unique transaction UUID from order number (alphanumeric + hyphens only) */
function buildTransactionUuid(orderNumber) {
  // eSewa only allows alphanumeric and hyphens
  return orderNumber.replace(/[^a-zA-Z0-9-]/g, '');
}

// ─── Stripe ─────────────────────────────────────────────────────────────────

// @route POST /api/payments/stripe/create-intent
export const createStripeIntent = async (req, res, next) => {
  const { orderId } = req.body;
  const order = await Order.findById(orderId);

  if (!order) return next(new AppError('Order not found.', 404));
  if (order.buyer.toString() !== req.user._id.toString()) {
    return next(new AppError('Not authorized.', 403));
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(order.totalPrice * 100),
      currency: 'npr',
      metadata: { orderId: order._id.toString(), orderNumber: order.orderNumber },
    });

    res.json({ success: true, clientSecret: paymentIntent.client_secret });
  } catch (err) {
    logger.error(`Stripe error: ${err.message}`);
    return next(new AppError('Payment processing failed.', 500));
  }
};

// @route POST /api/payments/stripe/webhook
export const stripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.error(`Stripe webhook error: ${err.message}`);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    await Order.findByIdAndUpdate(pi.metadata.orderId, {
      paymentStatus: 'paid',
      'paymentDetails.transactionId': pi.id,
      'paymentDetails.paidAt': new Date(),
      status: 'confirmed',
      $push: { trackingHistory: { status: 'confirmed', description: 'Payment confirmed via Stripe.' } },
    });
  }

  res.json({ received: true });
};

// ─── eSewa v2 ────────────────────────────────────────────────────────────────

// @route POST /api/payments/esewa/initiate
export const initiateEsewa = async (req, res, next) => {
  const { orderId } = req.body;
  const order = await Order.findById(orderId);
  if (!order) return next(new AppError('Order not found.', 404));
  if (order.buyer.toString() !== req.user._id.toString()) {
    return next(new AppError('Not authorized.', 403));
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const productCode = process.env.ESEWA_MERCHANT_ID || 'EPAYTEST';
  const secretKey   = process.env.ESEWA_SECRET_KEY  || '8gBm/:&EnhH.1/q';

  const amount       = order.itemsPrice;
  const taxAmount    = order.taxPrice;
  const deliveryCharge = order.shippingPrice;
  const totalAmount  = order.totalPrice;
  const transactionUuid = buildTransactionUuid(order.orderNumber);

  const signature = generateEsewaSignature(totalAmount, transactionUuid, productCode, secretKey);

  const successUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/payment/esewa/success?orderId=${orderId}`;
  const failureUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/payment/esewa/failure?orderId=${orderId}`;

  res.json({
    success: true,
    data: {
      url: isProduction ? ESEWA_PRODUCTION_URL : ESEWA_SANDBOX_URL,
      params: {
        amount:                   String(amount),
        tax_amount:               String(taxAmount),
        total_amount:             String(totalAmount),
        transaction_uuid:         transactionUuid,
        product_code:             productCode,
        product_service_charge:   '0',
        product_delivery_charge:  String(deliveryCharge),
        success_url:              successUrl,
        failure_url:              failureUrl,
        signed_field_names:       'total_amount,transaction_uuid,product_code',
        signature,
      },
    },
  });
};

// @route GET /api/payments/esewa/verify  (called after redirect back from eSewa)
export const verifyEsewa = async (req, res, next) => {
  // eSewa v2 sends response as Base64-encoded JSON in `data` query param
  const { data, orderId } = req.query;

  if (!data || !orderId) {
    return next(new AppError('Missing verification data.', 400));
  }

  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
  } catch {
    return next(new AppError('Invalid eSewa response data.', 400));
  }

  logger.info(`eSewa callback decoded: ${JSON.stringify(decoded)}`);

  const order = await Order.findById(orderId);
  if (!order) return next(new AppError('Order not found.', 404));

  if (decoded.status !== 'COMPLETE') {
    return next(new AppError(`eSewa payment ${decoded.status || 'failed'}.`, 400));
  }

  // Verify signature of response (optional but recommended)
  const productCode = process.env.ESEWA_MERCHANT_ID || 'EPAYTEST';
  const secretKey   = process.env.ESEWA_SECRET_KEY  || '8gBm/:&EnhH.1/q';

  const expectedSig = (() => {
    const fields = (decoded.signed_field_names || '').split(',');
    const message = fields.map((f) => `${f}=${decoded[f]}`).join(',');
    return crypto.createHmac('sha256', secretKey).update(message).digest('base64');
  })();

  if (decoded.signature && decoded.signature !== expectedSig) {
    logger.warn(`eSewa signature mismatch for order ${orderId}`);
    return next(new AppError('eSewa signature verification failed.', 400));
  }

  order.paymentStatus = 'paid';
  order.status = 'confirmed';
  order.paymentDetails = {
    transactionId: decoded.transaction_code,
    paidAt: new Date(),
  };
  order.trackingHistory.push({
    status: 'confirmed',
    description: `Payment verified via eSewa. Ref: ${decoded.transaction_code}`,
  });
  await order.save();

  res.json({ success: true, data: order });
};

// ─── Khalti v2 ───────────────────────────────────────────────────────────────

// @route POST /api/payments/khalti/initiate
export const initiateKhalti = async (req, res, next) => {
  const { orderId } = req.body;
  const order = await Order.findById(orderId);
  if (!order) return next(new AppError('Order not found.', 404));
  if (order.buyer.toString() !== req.user._id.toString()) {
    return next(new AppError('Not authorized.', 403));
  }

  const payload = {
    return_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/payment/khalti/callback`,
    website_url: process.env.CLIENT_URL || 'http://localhost:5173',
    amount: order.totalPrice * 100, // in paisa
    purchase_order_id: order.orderNumber,
    purchase_order_name: `MeroBazaar Order #${order.orderNumber}`,
    customer_info: {
      name: order.shippingAddress.fullName,
      email: req.user.email,
      phone: order.shippingAddress.phone,
    },
  };

  try {
    // Sandbox mock — replace with real Khalti API call in production:
    // const resp = await axios.post('https://a.khalti.com/api/v2/epayment/initiate/', payload, {
    //   headers: { Authorization: `Key ${process.env.KHALTI_SECRET_KEY}` }
    // });
    // return res.json({ success: true, data: resp.data });

    res.json({
      success: true,
      data: {
        pidx: `KHALTI_TEST_${Date.now()}`,
        payment_url: `https://test-pay.khalti.com/?pidx=test_${order.orderNumber}`,
        orderId,
      },
    });
  } catch (err) {
    return next(new AppError('Khalti initiation failed.', 500));
  }
};

// @route POST /api/payments/khalti/verify
export const verifyKhalti = async (req, res, next) => {
  const { pidx, orderId } = req.body;
  const order = await Order.findById(orderId);
  if (!order) return next(new AppError('Order not found.', 404));

  order.paymentStatus = 'paid';
  order.status = 'confirmed';
  order.paymentDetails = { pidx, paidAt: new Date() };
  order.trackingHistory.push({ status: 'confirmed', description: 'Payment verified via Khalti.' });
  await order.save();

  res.json({ success: true, data: order });
};
