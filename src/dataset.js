/**
 * Gullak Local Backend Acceptance Benchmark Suite
 * 
 * 20 Predefined Acceptance Cases matching the exact requirements from The Ken Round 3:
 * 01 normal merchant consumption
 * 02 loan to friend
 * 03 repayment from friend
 * 04 shared dinner split
 * 05 reimbursement
 * 06 bank transfer
 * 07 investment
 * 08 refund
 * 09 salary/income
 * 10 ATM withdrawal
 * 11 unknown transaction
 * 12 ambiguous P2P
 * 13 Hinglish clarification
 * 14 repeated counterparty using memory
 * 15 contradictory memory
 * 16 duplicate transaction
 * 17 e-commerce + logistics corroboration
 * 18 API timeout
 * 19 malformed external response
 * 20 user says NO / refuses clarification
 * 
 * NOTE: These are local backend acceptance tests verifying deterministic financial logic.
 * They are NOT the Pine Labs AgenticOrg Shadow Evaluation (which runs inside AgenticOrg).
 */

const benchmarkCases = [
  {
    id: 'CASE-01',
    name: 'Normal Merchant Consumption',
    category: 'CONSUMPTION',
    input: {
      transaction_id: 'TXN_001',
      amount: 450,
      direction: 'DEBIT',
      counterparty: 'Swiggy',
      raw_narration: 'UPI/Swiggy Order 8812/swiggy@icici'
    },
    expected: {
      classification: 'CONSUMPTION',
      consumption_amount: 450,
      budget_impact: 450,
      requires_clarification: false,
      min_confidence: 0.88
    }
  },
  {
    id: 'CASE-02',
    name: 'Loan to Friend (Requires Clarification -> LOAN)',
    category: 'LOAN',
    input: {
      transaction_id: 'TXN_002',
      amount: 1500,
      direction: 'DEBIT',
      counterparty: 'Rahul',
      vpa: 'rahul@oksbi',
      raw_narration: 'UPI/Payment to rahul@oksbi'
    },
    user_clarification: 'I lent him the money.',
    expected: {
      initial_requires_clarification: true,
      final_classification: 'LOAN',
      final_consumption_amount: 0,
      final_budget_impact: 0,
      loan_receivable: 1500
    }
  },
  {
    id: 'CASE-03',
    name: 'Repayment Received from Friend',
    category: 'REPAYMENT',
    input: {
      transaction_id: 'TXN_003',
      amount: 1500,
      direction: 'CREDIT',
      counterparty: 'Rahul',
      vpa: 'rahul@oksbi',
      raw_narration: 'UPI/Credit from rahul@oksbi'
    },
    expected: {
      classification: 'REPAYMENT',
      consumption_amount: 0,
      budget_impact: 0,
      loan_recovered: 1500,
      requires_clarification: false,
      min_confidence: 0.88
    }
  },
  {
    id: 'CASE-04',
    name: 'Shared Dinner Split',
    category: 'SPLIT',
    input: {
      transaction_id: 'TXN_004',
      amount: 4000,
      direction: 'DEBIT',
      counterparty: 'Barbeque Nation',
      raw_narration: 'POS/BBQ Nation Restaurant'
    },
    user_clarification: 'We split this between 4 friends, my share was 1000',
    expected: {
      final_classification: 'SPLIT',
      final_consumption_amount: 1000,
      final_shared_amount: 3000,
      final_budget_impact: 1000
    }
  },
  {
    id: 'CASE-05',
    name: 'Corporate Expense Reimbursement',
    category: 'REIMBURSEMENT',
    input: {
      transaction_id: 'TXN_005',
      amount: 3000,
      direction: 'CREDIT',
      counterparty: 'Acme Corp Accounts',
      raw_narration: 'NEFT/Reimbursement for Travel'
    },
    user_clarification: 'office travel reimbursement claim',
    expected: {
      final_classification: 'REIMBURSEMENT',
      final_consumption_amount: 0,
      final_budget_impact: 0
    }
  },
  {
    id: 'CASE-06',
    name: 'Bank Transfer (Savings to Current)',
    category: 'TRANSFER',
    input: {
      transaction_id: 'TXN_006',
      amount: 10000,
      direction: 'DEBIT',
      counterparty: 'user_hdfc_current_8819',
      vpa: 'ayush@okaxis',
      raw_narration: 'Internal Self Transfer to Current A/C'
    },
    expected: {
      classification: 'TRANSFER',
      consumption_amount: 0,
      budget_impact: 0,
      requires_clarification: false,
      min_confidence: 0.88
    }
  },
  {
    id: 'CASE-07',
    name: 'Investment (SIP Mutual Fund)',
    category: 'SAVING',
    input: {
      transaction_id: 'TXN_007',
      amount: 10000,
      direction: 'DEBIT',
      counterparty: 'Zerodha',
      raw_narration: 'ACH/Zerodha Broking SIP Investment'
    },
    expected: {
      classification: 'SAVING',
      consumption_amount: 0,
      budget_impact: 0,
      savings_impact: 10000,
      requires_clarification: false,
      min_confidence: 0.88
    }
  },
  {
    id: 'CASE-08',
    name: 'Merchant E-Commerce Refund',
    category: 'REFUND',
    input: {
      transaction_id: 'TXN_008',
      amount: 1200,
      direction: 'CREDIT',
      counterparty: 'Amazon India',
      raw_narration: 'UPI/Refund from Amazon India/RET882'
    },
    expected: {
      classification: 'REFUND',
      consumption_amount: -1200,
      budget_impact: -1200,
      requires_clarification: false,
      min_confidence: 0.88
    }
  },
  {
    id: 'CASE-09',
    name: 'Salary / Primary Income',
    category: 'INCOME',
    input: {
      transaction_id: 'TXN_009',
      amount: 100000,
      direction: 'CREDIT',
      counterparty: 'Employer Payroll Ltd',
      raw_narration: 'ACH/Monthly Salary Credit/Sept 2026'
    },
    expected: {
      classification: 'INCOME',
      consumption_amount: 0,
      budget_impact: 0,
      requires_clarification: false,
      min_confidence: 0.95
    }
  },
  {
    id: 'CASE-10',
    name: 'ATM Cash Withdrawal',
    category: 'CASH_WITHDRAWAL',
    input: {
      transaction_id: 'TXN_010',
      amount: 5000,
      direction: 'DEBIT',
      counterparty: 'HDFC Bank ATM',
      raw_narration: 'ATM/Cash WDL 5000/Indiranagar'
    },
    expected: {
      classification: 'CASH_WITHDRAWAL',
      consumption_amount: 0,
      budget_impact: 0,
      requires_clarification: false,
      min_confidence: 0.88
    }
  },
  {
    id: 'CASE-11',
    name: 'Unknown Transaction (Unfamiliar UPI)',
    category: 'UNKNOWN',
    input: {
      transaction_id: 'TXN_011',
      amount: 1800,
      direction: 'DEBIT',
      counterparty: 'StrangerVPA',
      vpa: 'unfamiliar99@paytm',
      raw_narration: 'UPI/Payment to unfamiliar99@paytm'
    },
    expected: {
      initial_requires_clarification: true,
      min_confidence: 0.50
    }
  },
  {
    id: 'CASE-12',
    name: 'Ambiguous Large P2P Transfer',
    category: 'AMBIGUOUS_P2P',
    input: {
      transaction_id: 'TXN_012',
      amount: 5000,
      direction: 'DEBIT',
      counterparty: 'Rohit',
      vpa: 'rohit@icici',
      raw_narration: 'UPI/Transfer 5000 to rohit@icici'
    },
    user_clarification: 'I lent him 5000 for emergency medical expenses',
    expected: {
      initial_requires_clarification: true,
      final_classification: 'LOAN',
      final_consumption_amount: 0,
      final_budget_impact: 0
    }
  },
  {
    id: 'CASE-13',
    name: 'Hinglish Voice Clarification (STT Parsing)',
    category: 'VOICE_HINGLISH',
    voice_transcript: '1500 Rahul ko diya tha, woh udhaar tha.',
    input: {
      transaction_id: 'TXN_013',
      amount: 1500,
      direction: 'DEBIT',
      counterparty: 'Rahul',
      raw_narration: 'UPI/Payment to Rahul'
    },
    expected: {
      extracted_intent: 'LOAN',
      extracted_counterparty: 'Rahul',
      extracted_amount: 1500,
      final_classification: 'LOAN',
      final_consumption_amount: 0
    }
  },
  {
    id: 'CASE-14',
    name: 'Repeated Counterparty Using Stored Memory',
    category: 'LOAN',
    input: {
      transaction_id: 'TXN_014',
      amount: 2000,
      direction: 'DEBIT',
      counterparty: 'Rahul',
      vpa: 'rahul@oksbi',
      raw_narration: 'UPI/Transfer to rahul@oksbi'
    },
    expected: {
      classification: 'LOAN',
      consumption_amount: 0,
      budget_impact: 0,
      requires_clarification: false,
      min_confidence: 0.88
    }
  },
  {
    id: 'CASE-15',
    name: 'Contradictory Memory (Narration contradicts LOAN context)',
    category: 'CONTRADICTORY_MEMORY',
    input: {
      transaction_id: 'TXN_015',
      amount: 800,
      direction: 'DEBIT',
      counterparty: 'Rahul',
      vpa: 'rahul@oksbi',
      raw_narration: 'UPI/Dinner split with Rahul at Toit'
    },
    expected: {
      initial_requires_clarification: true, // Contradiction forces clarification!
      confidence_below_floor: true
    }
  },
  {
    id: 'CASE-16',
    name: 'Duplicate Transaction Detected',
    category: 'DUPLICATE_DETECTION',
    input: {
      transaction_id: 'TXN_016_DUP',
      amount: 450,
      direction: 'DEBIT',
      counterparty: 'Swiggy',
      raw_narration: 'UPI/Swiggy Order 8812/swiggy@icici' // Identical to CASE-01
    },
    expected: {
      classification: 'UNKNOWN',
      initial_requires_clarification: true, // Flagged for confirmation
      confidence_below_floor: true
    }
  },
  {
    id: 'CASE-17',
    name: 'E-Commerce + Logistics Corroboration',
    category: 'DELHIVERY_CORROBORATION',
    input: {
      transaction_id: 'TXN_017',
      amount: 2499,
      direction: 'DEBIT',
      counterparty: 'Amazon India',
      raw_narration: 'PG/Amazon Pay E-Commerce'
    },
    delhivery_waybill: 'DELHIVERY_AMZN_9918',
    expected: {
      classification: 'CONSUMPTION',
      consumption_amount: 2499,
      delhivery_status: 'Delivered',
      requires_clarification: false,
      min_confidence: 0.88
    }
  },
  {
    id: 'CASE-18',
    name: 'API Timeout (Safe Failure Mode)',
    category: 'API_TIMEOUT',
    input: {
      transaction_id: 'TXN_018_TIMEOUT',
      amount: 500,
      direction: 'DEBIT',
      counterparty: 'AnyMerchant',
      simulate_timeout: true
    },
    expected: {
      error: 'CONNECTOR_TIMEOUT',
      status: 504,
      consumption_amount: 0,
      budget_impact: 0
    }
  },
  {
    id: 'CASE-19',
    name: 'Malformed External Response (Safe Failure Mode)',
    category: 'MALFORMED_RESPONSE',
    input: {
      transaction_id: 'TXN_019_MALFORMED',
      amount: 750,
      direction: 'DEBIT',
      counterparty: 'AnyMerchant',
      simulate_malformed: true
    },
    expected: {
      error: 'MALFORMED_EXTERNAL_RESPONSE',
      status: 502,
      consumption_amount: 0,
      budget_impact: 0
    }
  },
  {
    id: 'CASE-20',
    name: 'User Says NO / Refuses Clarification',
    category: 'USER_REFUSAL',
    input: {
      transaction_id: 'TXN_020',
      amount: 1500,
      direction: 'DEBIT',
      counterparty: 'StrangerPerson',
      raw_narration: 'UPI/Personal transfer'
    },
    user_clarification: 'None of your business, I refuse to say',
    expected: {
      final_classification: 'UNKNOWN',
      safe_handling: true
    }
  }
];

module.exports = { benchmarkCases };
