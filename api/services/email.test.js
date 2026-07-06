'use strict';

/**
 * Unit tests for the Resend transactional email service (Phase 06-04).
 * Mocks the `resend` module — no real network calls to Resend's API.
 */

const mockSend = jest.fn().mockResolvedValue({ data: { id: 'email_123' }, error: null });

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

const { sendOrderConfirmation, sendBandNotification } = require('./email');

const baseOrder = {
  orderNumber: 'HRK-ABCDEF',
  customerEmail: 'customer@example.com',
  customerName: 'Jane Doe',
  totalAmount: 45.5,
  items: [
    { productId: 'p1', variantSku: 'TSHIRT-M', name: 'Tour T-Shirt', quantity: 2, priceAtPurchase: 20 },
    { productId: 'p2', variantSku: 'PATCH-1', name: 'Logo Patch', quantity: 1, priceAtPurchase: 5.5 },
  ],
  shippingAddress: {
    addressLine1: '12 Rue de la Musique',
    addressLine2: 'Apt 4',
    city: 'Lyon',
    postalCode: '69001',
    country: 'France',
  },
};

describe('email service', () => {
  const originalBandEmail = process.env.BAND_NOTIFICATION_EMAIL;

  beforeEach(() => {
    mockSend.mockClear();
    process.env.BAND_NOTIFICATION_EMAIL = 'band@hurakanband.fr';
  });

  afterAll(() => {
    process.env.BAND_NOTIFICATION_EMAIL = originalBandEmail;
  });

  describe('sendOrderConfirmation', () => {
    it('sends exactly one email to the customer address', async () => {
      await sendOrderConfirmation(baseOrder);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0][0];
      expect(call.to).toEqual(['customer@example.com']);
    });

    it('sends from the branded noreply@hurakanband.fr address', async () => {
      await sendOrderConfirmation(baseOrder);

      const call = mockSend.mock.calls[0][0];
      expect(call.from).toBe('Hurakan <noreply@hurakanband.fr>');
    });

    it('subject contains the order number', async () => {
      await sendOrderConfirmation(baseOrder);

      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toContain('HRK-ABCDEF');
    });

    it('html contains the exact French VAT-exemption mention (D-17)', async () => {
      await sendOrderConfirmation(baseOrder);

      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('TVA non applicable, art. 293 B du CGI');
    });

    it('html contains each item, the EUR total, and the shipping address', async () => {
      await sendOrderConfirmation(baseOrder);

      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('Tour T-Shirt');
      expect(call.html).toContain('Logo Patch');
      expect(call.html).toContain('€45.50');
      expect(call.html).toContain('Lyon');
      expect(call.html).toContain('69001');
    });

    it('html contains no tracking/analytics pixel', async () => {
      await sendOrderConfirmation(baseOrder);

      const call = mockSend.mock.calls[0][0];
      expect(call.html.toLowerCase()).not.toContain('pixel');
      expect(call.html.toLowerCase()).not.toMatch(/<img[^>]*1x1/);
    });
  });

  describe('sendBandNotification', () => {
    it('sends exactly one email to BAND_NOTIFICATION_EMAIL', async () => {
      await sendBandNotification(baseOrder);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0][0];
      expect(call.to).toEqual(['band@hurakanband.fr']);
    });

    it('subject contains the order number', async () => {
      await sendBandNotification(baseOrder);

      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toContain('HRK-ABCDEF');
    });

    it('html includes the shipping address (city/address fields) prominently', async () => {
      await sendBandNotification(baseOrder);

      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('12 Rue de la Musique');
      expect(call.html).toContain('Lyon');
      expect(call.html).toContain('69001');
      expect(call.html).toContain('France');
    });

    it('html contains no tracking/analytics pixel', async () => {
      await sendBandNotification(baseOrder);

      const call = mockSend.mock.calls[0][0];
      expect(call.html.toLowerCase()).not.toContain('pixel');
    });

    it('flags a stock shortfall in the html when passed { shortfall: true }', async () => {
      await sendBandNotification(baseOrder, { shortfall: true });

      const call = mockSend.mock.calls[0][0];
      expect(call.html).toMatch(/shortfall/i);
    });
  });
});
