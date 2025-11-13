import { inngest } from "@/lib/inngest/client";
import { checkBudgetAlert, generateMonthlyReport, processRecurringTransaction, triggerRecurringTransactions } from "@/lib/inngest/functions";
import { serve } from "inngest/next";


// Configure the Inngest handler
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [checkBudgetAlert, triggerRecurringTransactions, processRecurringTransaction, generateMonthlyReport],
  servePath: "/api/inngest",
});