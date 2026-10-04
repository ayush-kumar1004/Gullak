/**
 * Capability 3: Adaptive Daily Budget & Savings Protection Engine
 * 
 * Adapts remaining daily spending budget based on ACTUAL personal consumption,
 * not gross transaction movement.
 * Spreads overspends smoothly across remaining days of the billing cycle.
 * Strictly shields and locks the user's monthly savings target.
 */

class AdaptiveBudgetEngine {
  constructor() {
    this.userState = {
      user_id: 'usr_gullak_01',
      monthly_income: 100000.0,
      monthly_savings_goal: 15000.0,
      monthly_fixed_needs: 45000.0, // Rent, utilities, insurance
      discretionary_buffer: 5000.0,
      total_days_in_month: 30,
      remaining_days: 10,
      planned_daily_budget: 300.0,
      current_daily_budget: 300.0,
      total_month_consumption: 0.0,
      savings_shield_active: true
    };
    this.pendingTradeoff = null;
  }

  getState() {
    return {
      ...this.userState,
      has_pending_tradeoff: !!this.pendingTradeoff,
      pending_tradeoff: this.pendingTradeoff
    };
  }

  setBudgetParameters({
    monthly_income,
    monthly_savings_goal,
    planned_daily_budget,
    remaining_days,
    discretionary_buffer
  }) {
    if (monthly_income !== undefined) this.userState.monthly_income = parseFloat(monthly_income);
    if (monthly_savings_goal !== undefined) this.userState.monthly_savings_goal = parseFloat(monthly_savings_goal);
    if (planned_daily_budget !== undefined) {
      this.userState.planned_daily_budget = parseFloat(planned_daily_budget);
      this.userState.current_daily_budget = parseFloat(planned_daily_budget);
    }
    if (remaining_days !== undefined) this.userState.remaining_days = parseInt(remaining_days, 10);
    if (discretionary_buffer !== undefined) this.userState.discretionary_buffer = parseFloat(discretionary_buffer);
    return this.getState();
  }

  /**
   * Adapts the daily budget when actual personal spending occurs.
   * INVIOLABLE FAIL-CLOSED GUARDRAIL:
   * The backend must NEVER mutate budget state unless:
   * 1. classification === 'CONSUMPTION'
   * 2. confidence >= 0.88
   * 3. actual_personal_spending > 0
   */
  adaptBudget({
    actual_personal_spending,
    planned_daily_budget = null,
    remaining_days = null,
    transaction_id = null,
    classification = null,
    confidence = null
  }) {
    const baseDaily = planned_daily_budget !== null && planned_daily_budget !== undefined ? parseFloat(planned_daily_budget) : this.userState.current_daily_budget;
    const daysLeft = remaining_days !== null && remaining_days !== undefined ? parseInt(remaining_days, 10) : this.userState.remaining_days;

    const parsedConf = confidence !== null && confidence !== undefined ? parseFloat(confidence) : null;
    const isVerifiedConsumption = classification === 'CONSUMPTION' && parsedConf !== null && !isNaN(parsedConf) && parsedConf >= 0.88;

    // Fail-Closed Check 1: Must be verified CONSUMPTION with confidence >= 0.88
    if (!isVerifiedConsumption) {
      return {
        transaction_id,
        status: 'REJECTED',
        budget_mutated: false,
        budget_impact: 0,
        actual_personal_spending: 0,
        overspend: 0,
        previous_daily_budget: baseDaily,
        new_daily_budget: baseDaily,
        daily_adjustment: 0,
        remaining_days: daysLeft,
        savings_goal_protected: true,
        savings_goal_amount: this.userState.monthly_savings_goal,
        reason: 'Budget adaptation requires verified CONSUMPTION classification with confidence >= 0.88.',
        explanation: 'Budget adaptation requires verified CONSUMPTION classification with confidence >= 0.88.'
      };
    }

    const spending = parseFloat(actual_personal_spending);

    // Fail-Closed Check 2: actual_personal_spending must be a valid positive number
    if (isNaN(spending) || spending <= 0) {
      return {
        transaction_id,
        status: 'REJECTED',
        budget_mutated: false,
        budget_impact: 0,
        actual_personal_spending: 0,
        overspend: 0,
        previous_daily_budget: baseDaily,
        new_daily_budget: baseDaily,
        daily_adjustment: 0,
        remaining_days: daysLeft,
        savings_goal_protected: true,
        savings_goal_amount: this.userState.monthly_savings_goal,
        reason: 'Budget adaptation requires actual_personal_spending > 0.',
        explanation: 'Budget adaptation requires actual_personal_spending > 0.'
      };
    }

    const overspend = spending - baseDaily;

    // Spending within daily allowance: on track, no reduction to daily limit
    if (overspend <= 0) {
      this.userState.total_month_consumption += spending;
      return {
        transaction_id,
        status: 'ON_TRACK',
        budget_mutated: true,
        budget_impact: spending,
        actual_personal_spending: spending,
        overspend: 0,
        previous_daily_budget: baseDaily,
        new_daily_budget: baseDaily,
        daily_adjustment: 0,
        remaining_days: daysLeft,
        savings_goal_protected: true,
        savings_goal_amount: this.userState.monthly_savings_goal,
        requires_user_tradeoff: false,
        explanation: `Personal spending of ₹${spending} was within your planned daily allowance of ₹${baseDaily}. Budget remains on track.`
      };
    }

    // Overspend occurred: calculate smooth daily adjustment across remaining days
    const safeDays = Math.max(1, daysLeft);
    const dailyAdjustment = Math.round((overspend / safeDays) * 100) / 100;
    const potentialNewDaily = Math.round((baseDaily - dailyAdjustment) * 100) / 100;

    // Savings Goal Shield check:
    // If the new daily budget drops to <= 0, do NOT silently erase savings.
    // Halt mutation and require deterministic user authorization.
    if (potentialNewDaily <= 0) {
      this.pendingTradeoff = {
        transaction_id,
        spending,
        overspend,
        baseDaily,
        safeDays,
        potentialNewDaily,
        created_at: new Date().toISOString()
      };

      return {
        transaction_id,
        status: 'SAVINGS_PROTECTION_ALERT',
        budget_mutated: false,
        budget_impact: 0,
        actual_personal_spending: spending,
        overspend,
        previous_daily_budget: baseDaily,
        calculated_daily_budget: potentialNewDaily,
        daily_adjustment: dailyAdjustment,
        remaining_days: daysLeft,
        savings_goal_protected: true,
        savings_goal_amount: this.userState.monthly_savings_goal,
        requires_user_tradeoff: true,
        tradeoff_options: ['BUFFER', 'TEMPORARY_ADJUSTMENT'],
        explanation: `Extreme spending of ₹${spending} creates an overspend of ₹${overspend}. Smoothing this across ${safeDays} days would make your daily budget negative (₹${potentialNewDaily}/day). Your ₹${this.userState.monthly_savings_goal} savings goal is LOCKED and will not be reduced. Please choose an authorized tradeoff: (BUFFER) Dip into your ₹${this.userState.discretionary_buffer} buffer, or (TEMPORARY_ADJUSTMENT) Authorize a temporary adjustment.`
      };
    }

    // Normal smooth adjustment
    this.userState.total_month_consumption += spending;
    this.userState.current_daily_budget = potentialNewDaily;

    return {
      transaction_id,
      status: 'ADAPTED',
      budget_mutated: true,
      budget_impact: spending,
      actual_personal_spending: spending,
      overspend,
      previous_daily_budget: baseDaily,
      new_daily_budget: potentialNewDaily,
      daily_adjustment: dailyAdjustment,
      remaining_days: daysLeft,
      savings_goal_protected: true,
      savings_goal_amount: this.userState.monthly_savings_goal,
      requires_user_tradeoff: false,
      explanation: `Overspent ₹${overspend} today. Spreading this across the remaining ${safeDays} days adjusts your daily allowance by -₹${dailyAdjustment} to ₹${potentialNewDaily}/day. Your ₹${this.userState.monthly_savings_goal} savings target remains 100% protected.`
    };
  }

  /**
   * Deterministic Backend Operation: Authorize Budget Tradeoff
   * Allowed choices:
   * - BUFFER: Absorbs overspend using discretionary_buffer, keeping daily budget at planned rate.
   * - TEMPORARY_ADJUSTMENT: Sets an emergency minimum daily allowance floor for remaining days.
   * INVIOLABLE: The savings goal (₹15,000) MUST remain unchanged in all flows.
   */
  authorizeTradeoff({
    tradeoff_type,
    minimum_daily_budget,
    overspend_amount
  } = {}) {
    const choice = typeof tradeoff_type === 'string' ? tradeoff_type.trim().toUpperCase() : '';
    const previousBudget = this.userState.current_daily_budget;

    // Validate authorization choice
    if (choice !== 'BUFFER' && choice !== 'TEMPORARY_ADJUSTMENT') {
      return {
        status: 'REJECTED',
        authorized: false,
        authorization_status: 'REJECTED',
        budget_mutated: false,
        previous_budget: previousBudget,
        new_budget: previousBudget,
        selected_tradeoff: tradeoff_type || 'NONE',
        savings_goal: this.userState.monthly_savings_goal,
        savings_goal_protected: true,
        reason: "Invalid tradeoff choice. Allowed choices are 'BUFFER' or 'TEMPORARY_ADJUSTMENT'. Monthly savings goal cannot be modified.",
        explanation: "Tradeoff authorization rejected: Only 'BUFFER' and 'TEMPORARY_ADJUSTMENT' are permitted."
      };
    }

    if (choice === 'BUFFER') {
      const overspendToAbsorb = this.pendingTradeoff
        ? this.pendingTradeoff.overspend
        : (overspend_amount !== undefined ? parseFloat(overspend_amount) : 500.0);

      const prevBuffer = this.userState.discretionary_buffer;
      this.userState.discretionary_buffer = Math.max(0, this.userState.discretionary_buffer - overspendToAbsorb);
      this.userState.current_daily_budget = this.userState.planned_daily_budget;
      this.userState.tradeoff_decision = {
        type: 'BUFFER',
        overspend_absorbed: overspendToAbsorb,
        timestamp: new Date().toISOString()
      };
      this.pendingTradeoff = null;

      return {
        status: 'AUTHORIZED',
        authorized: true,
        authorization_status: 'AUTHORIZED',
        budget_mutated: true,
        previous_budget: previousBudget,
        new_budget: this.userState.current_daily_budget,
        selected_tradeoff: 'BUFFER',
        previous_buffer: prevBuffer,
        discretionary_buffer_remaining: this.userState.discretionary_buffer,
        savings_goal: this.userState.monthly_savings_goal,
        savings_goal_protected: true,
        explanation: `Authorized BUFFER deduction. Absorbed overspend of ₹${overspendToAbsorb} using discretionary buffer. Daily budget maintained at ₹${this.userState.current_daily_budget}/day. Inviolable savings goal of ₹${this.userState.monthly_savings_goal} is 100% protected.`
      };
    }

    if (choice === 'TEMPORARY_ADJUSTMENT') {
      const floor = minimum_daily_budget !== undefined ? parseFloat(minimum_daily_budget) : 100.0;
      this.userState.current_daily_budget = floor;
      this.userState.tradeoff_decision = {
        type: 'TEMPORARY_ADJUSTMENT',
        minimum_daily_budget: floor,
        timestamp: new Date().toISOString()
      };
      this.pendingTradeoff = null;

      return {
        status: 'AUTHORIZED',
        authorized: true,
        authorization_status: 'AUTHORIZED',
        budget_mutated: true,
        previous_budget: previousBudget,
        new_budget: this.userState.current_daily_budget,
        selected_tradeoff: 'TEMPORARY_ADJUSTMENT',
        savings_goal: this.userState.monthly_savings_goal,
        savings_goal_protected: true,
        explanation: `Authorized TEMPORARY_ADJUSTMENT. Daily budget adjusted to emergency allowance of ₹${floor}/day for remaining days. Inviolable savings goal of ₹${this.userState.monthly_savings_goal} is 100% protected.`
      };
    }
  }

  reset() {
    this.userState.current_daily_budget = this.userState.planned_daily_budget;
    this.userState.total_month_consumption = 0;
    this.userState.discretionary_buffer = 5000.0;
    this.userState.monthly_savings_goal = 15000.0;
    this.pendingTradeoff = null;
  }
}

module.exports = new AdaptiveBudgetEngine();
