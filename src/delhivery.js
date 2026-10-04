/**
 * Delhivery Logistics Rail (Official Documentation Mock)
 * 
 * Endpoints:
 * - GET /api/v1/packages/json/ (Package Tracking API)
 * - GET /c/api/pin-codes/json/ (Pincode Serviceability API)
 * 
 * Matches exact Delhivery API documentation schemas, status codes, and error modes.
 */

const express = require('express');
const router = express.Router();

// Seeded mock package statuses
const mockWaybills = new Map([
  ['123456789012', {
    waybill: '123456789012',
    status: 'Delivered',
    status_type: 'DL',
    status_date_time: '2026-10-02T14:32:00Z',
    origin: 'BOM/BHI',
    destination: 'BLR/KOR',
    consignee: 'Ayush Sharma',
    ref_id: 'AMZ_ORDER_9921',
    scans: [
      { scan_datetime: '2026-10-01T08:00:00Z', scan_location: 'Mumbai Hub', scan_type: 'UD', status: 'In Transit' },
      { scan_datetime: '2026-10-02T10:15:00Z', scan_location: 'Bengaluru Hub', scan_type: 'UD', status: 'Out for Delivery' },
      { scan_datetime: '2026-10-02T14:32:00Z', scan_location: 'Koramangala DC', scan_type: 'DL', status: 'Delivered' }
    ]
  }],
  ['DELHIVERY_AMZN_9918', {
    waybill: 'DELHIVERY_AMZN_9918',
    status: 'Delivered',
    status_type: 'DL',
    status_date_time: '2026-10-02T16:45:00Z',
    origin: 'DEL/GGN',
    destination: 'BLR/HSR',
    consignee: 'Ayush Sharma',
    ref_id: 'AMZN_DEBIT_2499',
    scans: [
      { scan_datetime: '2026-10-02T16:45:00Z', scan_location: 'HSR Layout DC', scan_type: 'DL', status: 'Delivered' }
    ]
  }],
  ['DELHIVERY_RET_7741', {
    waybill: 'DELHIVERY_RET_7741',
    status: 'Returned',
    status_type: 'RT',
    status_date_time: '2026-10-01T11:20:00Z',
    origin: 'BLR/KOR',
    destination: 'BOM/BHI',
    consignee: 'Merchant Returns Hub',
    ref_id: 'FLIPKART_RET_1200',
    scans: [
      { scan_datetime: '2026-10-01T11:20:00Z', scan_location: 'Bengaluru DC', scan_type: 'RT', status: 'Returned' }
    ]
  }]
]);

function getShipmentData({ waybill, ref_ids, simulate_error } = {}) {
  // Error simulation for test cases
  if (simulate_error === '404') {
    const err = new Error('Waybill not found');
    err.status = 404;
    throw err;
  }
  if (simulate_error === '500') {
    const err = new Error('Internal Server Error at Delhivery Gateway');
    err.status = 500;
    throw err;
  }

  const resolvedWaybill = waybill || (ref_ids ? 'DELHIVERY_AMZN_9918' : null);
  if (!resolvedWaybill) {
    const err = new Error('Missing required parameter: waybill or ref_ids');
    err.status = 400;
    throw err;
  }

  const pkg = mockWaybills.get(resolvedWaybill) || {
    waybill: resolvedWaybill,
    status: 'Delivered', // Default arbitrary test waybill to Delivered
    status_type: 'DL',
    status_date_time: new Date().toISOString(),
    origin: 'DEL/AIR',
    destination: 'BLR/AIR',
    consignee: 'Ayush Sharma',
    ref_id: ref_ids || `ORDER_${resolvedWaybill}`,
    scans: [
      { scan_datetime: new Date().toISOString(), scan_location: 'Local Hub', scan_type: 'DL', status: 'Delivered' }
    ]
  };

  return {
    ShipmentData: [
      {
        Shipment: {
          Status: {
            Status: pkg.status,
            StatusType: pkg.status_type,
            StatusDateTime: pkg.status_date_time,
            Instructions: 'Package delivered to consignee'
          },
          PickUpDate: '2026-10-01',
          ChargedWeight: 0.5,
          Origin: pkg.origin,
          Destination: pkg.destination,
          Consignee: {
            Name: pkg.consignee,
            City: 'Bengaluru',
            PinCode: 560034
          },
          ReferenceNo: pkg.ref_id,
          AWB: pkg.waybill,
          Scans: pkg.scans
        }
      }
    ]
  };
}

// GET /api/v1/packages/json/
router.get('/api/v1/packages/json', (req, res) => {
  const waybill = req.query.waybill;
  const ref_ids = req.query.ref_ids;
  const simulateError = req.query.simulate_error;

  if (simulateError === 'timeout') {
    // Return after simulated delay
    return setTimeout(() => res.status(504).json({ error: 'Gateway Timeout' }), 4500);
  }

  try {
    const data = getShipmentData({ waybill, ref_ids, simulate_error: simulateError });
    return res.json(data);
  } catch (err) {
    return res.status(err.status || 500).json({
      error: err.message,
      status: err.status || 500
    });
  }
});

// GET /c/api/pin-codes/json/
router.get('/c/api/pin-codes/json', (req, res) => {
  const pin = req.query.filter_codes || '560034';
  return res.json({
    delivery_codes: [
      {
        postal_code: {
          pin: parseInt(pin, 10),
          pre_paid: 'Y',
          cash: 'Y',
          pickup: 'Y',
          cod: 'Y',
          is_oda: 'N',
          sort_code: 'BLR/KOR'
        }
      }
    ]
  });
});

router.getShipmentData = getShipmentData;
router.mockWaybills = mockWaybills;

module.exports = router;
