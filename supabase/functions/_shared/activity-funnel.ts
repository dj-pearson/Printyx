// The activity funnel, worked backwards from a revenue goal (WF-S-06).
//
// A rep asks "how many calls do I have to make this month", and the answer is
// arithmetic over conversion rates they supply: revenue -> deals -> proposals ->
// meetings -> connections -> calls and emails. No database, no tenant, nothing
// to scope - which is why it lives here rather than inside the handler, and why
// it can be tested without one.
//
// Ported verbatim from server/routes-crm-goals.ts, including the two judgements
// it makes, because changing them would change every rep's number without
// anyone deciding to:
//
//   CONNECTIONS ARE SPLIT 50/50 between calls and emails. It is an assumption,
//   not a measurement, and it is stated on the response so the page can say so.
//   HALF the connections are chased by phone at the call answer rate and half by
//   email at the email response rate, which is why each divides by 2.
//
//   A MONTH IS 22 WORKING DAYS. Also an assumption. Both are returned under
//   `assumptions` rather than buried, since a daily target a rep is measured on
//   should say what it was derived from.
//
// A RATE OF ZERO IS NOT A DIVISION BY ZERO HERE. The Express original divided
// straight through, so a zero closing rate produced Infinity and the page
// rendered "Infinity calls per day". Zero means "this never converts", and the
// honest answer to "how many calls to close a deal that never closes" is that
// the question has none - so the field is null and the reason is named.

export interface FunnelRates {
  callAnswerRate: number;
  emailResponseRate: number;
  activityToMeetingRate: number;
  meetingToProposalRate: number;
  proposalClosingRate: number;
}

export interface FunnelInput extends FunnelRates {
  revenueGoal: number;
  averageDealSize: number;
}

export interface FunnelResult {
  revenueGoal: number;
  averageDealSize: number;
  conversionRates: FunnelRates;
  requiredActivities: {
    dealsNeeded: number | null;
    proposalsNeeded: number | null;
    meetingsNeeded: number | null;
    connectionsNeeded: number | null;
    totalCalls: number | null;
    totalEmails: number | null;
    totalActivities: number | null;
  };
  dailyBreakdown: {
    totalDaily: number | null;
    callsDaily: number | null;
    emailsDaily: number | null;
  };
  assumptions: string[];
  /** Named when a rate of zero makes part of the funnel unanswerable. */
  unbacked: string[];
}

export const WORKING_DAYS_PER_MONTH = 22;

/** Ceil a division, or null when the divisor cannot carry the question. */
function over(numerator: number | null, divisor: number): number | null {
  if (numerator === null || !Number.isFinite(divisor) || divisor <= 0) return null;
  return Math.ceil(numerator / divisor);
}

export function calculateActivityFunnel(input: FunnelInput): FunnelResult {
  const rates: FunnelRates = {
    callAnswerRate: Number(input.callAnswerRate) || 0,
    emailResponseRate: Number(input.emailResponseRate) || 0,
    activityToMeetingRate: Number(input.activityToMeetingRate) || 0,
    meetingToProposalRate: Number(input.meetingToProposalRate) || 0,
    proposalClosingRate: Number(input.proposalClosingRate) || 0,
  };

  const revenueGoal = Number(input.revenueGoal) || 0;
  const averageDealSize = Number(input.averageDealSize) || 0;

  const unbacked: string[] = [];
  const zeroRate = (label: string, value: number) => {
    if (value <= 0) unbacked.push(`${label} is zero, so the step above it has no answer.`);
    return value / 100;
  };

  const closing = zeroRate('proposalClosingRate', rates.proposalClosingRate);
  const proposal = zeroRate('meetingToProposalRate', rates.meetingToProposalRate);
  const meeting = zeroRate('activityToMeetingRate', rates.activityToMeetingRate);
  const call = zeroRate('callAnswerRate', rates.callAnswerRate);
  const email = zeroRate('emailResponseRate', rates.emailResponseRate);

  const dealsNeeded = over(revenueGoal, averageDealSize);
  if (dealsNeeded === null) {
    unbacked.push('averageDealSize is zero, so a revenue goal implies no deal count.');
  }

  const proposalsNeeded = over(dealsNeeded, closing);
  const meetingsNeeded = over(proposalsNeeded, proposal);
  const connectionsNeeded = over(meetingsNeeded, meeting);

  // Half the connections by phone, half by email - see the header.
  const totalCalls = over(over(connectionsNeeded, call), 2);
  const totalEmails = over(over(connectionsNeeded, email), 2);
  const totalActivities =
    totalCalls === null || totalEmails === null ? null : totalCalls + totalEmails;

  return {
    revenueGoal,
    averageDealSize,
    conversionRates: rates,
    requiredActivities: {
      dealsNeeded,
      proposalsNeeded,
      meetingsNeeded,
      connectionsNeeded,
      totalCalls,
      totalEmails,
      totalActivities,
    },
    dailyBreakdown: {
      totalDaily: over(totalActivities, WORKING_DAYS_PER_MONTH),
      callsDaily: over(totalCalls, WORKING_DAYS_PER_MONTH),
      emailsDaily: over(totalEmails, WORKING_DAYS_PER_MONTH),
    },
    assumptions: [
      'Connections are split evenly between calls and emails.',
      `A month is ${WORKING_DAYS_PER_MONTH} working days.`,
    ],
    unbacked,
  };
}
