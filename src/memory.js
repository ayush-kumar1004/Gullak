/**
 * Capability 1: Counterparty Semantic Memory Graph
 * 
 * Stores and retrieves historical relationships, confirmed transaction patterns,
 * typical intents, default split rules, and outstanding loan balances.
 * 
 * Features:
 * - Infer first, ask only when uncertain, confirm once, remember permanently.
 * - Contradiction detection: If new transaction evidence contradicts historical memory,
 *   lowers confidence and triggers a clarification question instead of blindly assuming.
 */

class CounterpartyMemoryEngine {
  constructor() {
    this.memory = new Map();
    this.seedDefaultKnowledge();
  }

  seedDefaultKnowledge() {
    // Known merchants with established commercial intent
    this.knownMerchants = new Map([
      ['swiggy', { name: 'Swiggy', category: 'FOOD_AND_DINING', typical_intent: 'CONSUMPTION', confidence_weight: 0.45 }],
      ['zomato', { name: 'Zomato', category: 'FOOD_AND_DINING', typical_intent: 'CONSUMPTION', confidence_weight: 0.45 }],
      ['starbucks', { name: 'Starbucks Coffee', category: 'FOOD_AND_DINING', typical_intent: 'CONSUMPTION', confidence_weight: 0.45 }],
      ['amazon', { name: 'Amazon India', category: 'SHOPPING', typical_intent: 'CONSUMPTION', confidence_weight: 0.42 }],
      ['flipkart', { name: 'Flipkart', category: 'SHOPPING', typical_intent: 'CONSUMPTION', confidence_weight: 0.42 }],
      ['uber', { name: 'Uber India', category: 'TRANSPORT', typical_intent: 'CONSUMPTION', confidence_weight: 0.45 }],
      ['ola', { name: 'Ola Cabs', category: 'TRANSPORT', typical_intent: 'CONSUMPTION', confidence_weight: 0.45 }],
      ['bescom', { name: 'BESCOM Electricity', category: 'UTILITY_BILL', typical_intent: 'CONSUMPTION', confidence_weight: 0.48 }],
      ['airtel', { name: 'Airtel Telecommunications', category: 'UTILITY_BILL', typical_intent: 'CONSUMPTION', confidence_weight: 0.48 }],
      ['croma', { name: 'Croma Electronics', category: 'SHOPPING', typical_intent: 'CONSUMPTION', confidence_weight: 0.45 }],
      ['reliance digital', { name: 'Reliance Digital', category: 'SHOPPING', typical_intent: 'CONSUMPTION', confidence_weight: 0.45 }],
      ['zerodha', { name: 'Zerodha Broking Ltd', category: 'INVESTMENT', typical_intent: 'SAVING', confidence_weight: 0.46 }],
      ['groww', { name: 'Groww Investments', category: 'INVESTMENT', typical_intent: 'SAVING', confidence_weight: 0.46 }]
    ]);

    // Initial user account identifiers for self-transfer detection
    this.userAccounts = new Set([
      'ayush@okaxis',
      'ayush.sbi@upi',
      'user_icici_savings_4120',
      'user_hdfc_current_8819'
    ]);
  }

  normalizeKey(key) {
    if (!key) return '';
    return key.trim().toLowerCase().replace(/[@._\s]/g, '');
  }

  isUserOwnAccount(vpaOrAccount) {
    if (!vpaOrAccount) return false;
    const norm = vpaOrAccount.toLowerCase();
    for (const acc of this.userAccounts) {
      if (acc.toLowerCase() === norm || norm.includes('self') || norm.includes('own account') || norm.includes('to own a/c')) {
        return true;
      }
    }
    return false;
  }

  getMerchantInfo(query) {
    if (!query) return null;
    const lower = query.toLowerCase();
    for (const [key, info] of this.knownMerchants.entries()) {
      if (lower.includes(key)) {
        return info;
      }
    }
    return null;
  }

  getCounterparty(identifier) {
    if (!identifier) return null;
    const key = this.normalizeKey(identifier);
    if (this.memory.has(key)) {
      return this.memory.get(key);
    }
    // Also check if any memory has matching counterparty or vpa
    for (const record of this.memory.values()) {
      const recKey = this.normalizeKey(record.counterparty || '');
      const vpaKey = this.normalizeKey(record.vpa || '');
      if (recKey === key || vpaKey === key) {
        return record;
      }
      // Partial match for first name or full name (e.g. "Rahul" matches "Rahul Sharma")
      if (key.length >= 3 && recKey.length >= 3 && (recKey.includes(key) || key.includes(recKey))) {
        return record;
      }
    }
    return null;
  }

  /**
   * Check if current transaction narration / metadata or user clarification contradicts stored memory.
   * Example: Rahul is marked as LOAN or RENT, but current input mentions "dinner payment" or "split".
   */
  detectContradiction(identifier, input = '') {
    const record = this.getCounterparty(identifier);
    if (!record) return { isContradiction: false, isConflict: false };

    const text = (input || '').toLowerCase();
    const storedIntent = (record.typical_intent || record.classification || '').toUpperCase();
    const storedNotes = (record.notes || '').toLowerCase();

    // Check for contradiction between stored LOAN and current SPLIT/FOOD/RENT keywords
    if (storedIntent === 'LOAN') {
      if (text.includes('split') || text.includes('dinner') || text.includes('food') || text.includes('rent') || text.includes('party')) {
        return {
          isContradiction: true,
          isConflict: true,
          stored_intent: storedIntent,
          stored_notes: record.notes,
          detected_conflicting_keyword: 'split/food/rent',
          reason: `Stored memory for ${record.counterparty} indicates loans, but current transaction/clarification mentions a shared dinner, food, or rent.`
        };
      }
    }

    // Check for contradiction between stored SPLIT and current LOAN keywords
    if (storedIntent === 'SPLIT') {
      if (text.includes('loan') || text.includes('udhaar') || text.includes('borrow')) {
        return {
          isContradiction: true,
          isConflict: true,
          stored_intent: storedIntent,
          stored_notes: record.notes,
          detected_conflicting_keyword: 'loan/udhaar',
          reason: `Stored memory for ${record.counterparty} indicates split expenses, but current input suggests a personal loan.`
        };
      }
    }

    // Check for contradiction between stored REPAYMENT/RENT and current DINNER/CONSUMPTION keywords
    if (storedIntent === 'REPAYMENT' || storedIntent === 'RENT' || storedIntent === 'RENT_REPAYMENT' || storedNotes.includes('rent')) {
      if (text.includes('dinner') || text.includes('food') || text.includes('grocery') || text.includes('shopping') || text.includes('party') || text.includes('personal')) {
        return {
          isContradiction: true,
          isConflict: true,
          stored_intent: storedIntent || 'RENT_REPAYMENT',
          stored_notes: record.notes || 'monthly rent repayment',
          detected_conflicting_keyword: 'dinner/consumption',
          reason: `Stored memory for ${record.counterparty} indicates '${record.notes || storedIntent}', but current transaction/clarification specifies dinner or personal spending.`
        };
      }
    }

    // Check for contradiction between stored CONSUMPTION and current LOAN/RENT keywords
    if (storedIntent === 'CONSUMPTION') {
      if (text.includes('loan') || text.includes('udhaar') || text.includes('rent')) {
        return {
          isContradiction: true,
          isConflict: true,
          stored_intent: storedIntent,
          stored_notes: record.notes,
          detected_conflicting_keyword: 'loan/rent',
          reason: `Stored memory for ${record.counterparty} indicates personal consumption, but current input specifies a loan or rent repayment.`
        };
      }
    }

    return { isContradiction: false, isConflict: false };
  }

  recordCounterparty({
    counterparty,
    vpa = '',
    classification,
    relationship = 'acquaintance',
    typical_intent = 'UNKNOWN',
    notes = '',
    default_split_pct = 50,
    confidence = 0.95,
    user_confirmed = true
  }) {
    const key = this.normalizeKey(counterparty || vpa);
    const existing = this.memory.get(key) || {
      counterparty,
      vpa,
      relationship,
      classification: classification || typical_intent,
      typical_intent: classification || typical_intent,
      total_transactions: 0,
      total_lent: 0,
      total_repaid: 0,
      outstanding_loan: 0,
      history: []
    };

    if (counterparty) existing.counterparty = counterparty;
    if (vpa) existing.vpa = vpa;
    if (relationship) existing.relationship = relationship;
    if (classification) {
      existing.classification = classification;
      existing.typical_intent = classification;
    } else if (typical_intent) {
      existing.typical_intent = typical_intent;
    }
    if (notes) {
      existing.notes = notes;
    }
    existing.default_split_pct = default_split_pct;
    existing.confidence = confidence;
    existing.user_confirmed = user_confirmed;
    existing.last_updated = new Date().toISOString();

    this.memory.set(key, existing);
    if (vpa && this.normalizeKey(vpa) !== key) {
      this.memory.set(this.normalizeKey(vpa), existing);
    }
    return existing;
  }

  updateLoanLedger(counterparty, amountDelta, type = 'LOAN') {
    const key = this.normalizeKey(counterparty);
    let record = this.memory.get(key);
    if (!record) {
      record = this.recordCounterparty({
        counterparty,
        classification: type === 'LOAN' ? 'LOAN' : 'REPAYMENT',
        relationship: 'friend'
      });
    }

    if (type === 'LOAN') {
      record.total_lent += amountDelta;
      record.outstanding_loan += amountDelta;
    } else if (type === 'REPAYMENT') {
      record.total_repaid += amountDelta;
      record.outstanding_loan = Math.max(0, record.outstanding_loan - amountDelta);
    }
    record.total_transactions += 1;
    record.last_updated = new Date().toISOString();
    this.memory.set(key, record);
    return record;
  }

  getAllMemories() {
    const list = [];
    for (const [key, value] of this.memory.entries()) {
      list.push({ key, ...value });
    }
    return list;
  }

  clear() {
    this.memory.clear();
    this.seedDefaultKnowledge();
  }
}

module.exports = new CounterpartyMemoryEngine();
