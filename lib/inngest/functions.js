
import { inngest } from "./client";
import { db } from "../prisma";
import { sendEmail } from "@/actions/send-email";
import EmailTemplate from "@/emails/template";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const checkBudgetAlert = inngest.createFunction(
  { name: "check budget alerts" },
  { cron: "0 */6 * * *" },
  async ({ step }) => {
    const budgets = await step.run("fetch-budget", async () => {
      return await db.budget.findMany({
        include: {
          user: {
            include: {
              accounts: {
                where: {
                  isDefault: true,
                },
              },
            },
          },
        },
      });
    });

    for (const budget of budgets) {
      const defaultAccount = budget.user.accounts[0];
      if (!defaultAccount) continue;

      await step.run(`check-budget-${budget.id}`, async () => {


        const currentDate = new Date();
        const startOfMonth = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            1,
        );
        const endOfMonth = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth() + 1,
            0,
        );


        const expenses = await db.transaction.aggregate({
          where: {
            userId: budget.userId,
            accountId: defaultAccount.id,
            type: 'EXPENSE',
            date: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
          _sum: {
            amount: true,
          },
        });

        const totalExpenses = expenses._sum.amount?.toNumber() || 0;
        const budgetAmount = Number(budget.amount);
        const percentageUsed = (totalExpenses / budgetAmount) * 100;

        if (
          percentageUsed >= 80 &&
          (!budget.lastAlertSent ||
            isNewMonth(new Date(budget.lastAlertSent), new Date()))
        ) {

          // SEND EMAIL
          await sendEmail({
            to: budget.user.email,
            subject: `Budget Alert for ${defaultAccount.name}`,
            react: EmailTemplate({
              userName: budget.user.name,
              type: "budget-alert",
              hideHeader: true,
              data: {
                percentageUsed,
                budgetAmount: parseInt(budgetAmount.toFixed(1)),
                totalExpenses: parseInt(totalExpenses.toFixed(1)),
                accountName: defaultAccount.name,
              }
            })
          })

          await db.budget.update({
            where: { id: budget.id },
            data: { lastAlertSent: new Date() },
          });
        }
      });
    }
  }
);

function isNewMonth(lastAlertDate, currentDate) {
  return (
    lastAlertDate.getMonth() !== currentDate.getMonth() ||
    lastAlertDate.getFullYear() !== currentDate.getFullYear()
  );
}

export const triggerRecurringTransactions = inngest.createFunction(
  {
    id: "trigger-recurring-transactions",
    name: "Trigger Recurring Transactions",
  },
  { cron: "0 0 * * *" },
  async ({ step }) => {

    //1. Fetch all due recurring transactions
    const recurringTransactions = await step.run(
      "fetch-recurring-transactions",
      async () => {
        return await db.transaction.findMany({
          where: {
            isRecurring: true,
            status: "COMPLETED",
            OR: [
              { lastProcessed: null },
              { nextRecurringDate: { lte: new Date() } }
            ],
          },
        });
      }
    );

    //2. Create events for each transactions
    if (recurringTransactions.length > 0) {
      const events = recurringTransactions.map((transaction) => ({
        name: "transaction.recurring.process",
        data: { transactionId: transaction.id, userId: transaction.userId },
      }));

      await inngest.send(events);
    }

    return { triggered: recurringTransactions.length };
  }
);

export const processRecurringTransaction = inngest.createFunction({
  id: "process-recurring-transaction",
  throttle: {
    limit: 10, //only process 10ntransactions
    period: "1m", // per minute
    key: "event.data.userId", // per user
  },
},
    { event: "transaction.recurring.process" },
    async ({ event, step }) => {
      // validate event data
      if(!event.data?.transactionId || !event.data?.userId){
        console.error("Invalid event data", event.data);
        return { error: "Missing required event data" };
      }
      await step.run("process-transaction", async () => {
        const transaction = await db.transaction.findUnique({
          where: {
            id: event.data.transactionId,
            userId: event.data.userId,
          },
          include: {
            account: true,

          },
        });

        if (!transaction || !isTransactionDue(transaction)) return;

        await db.$transaction(async (tx) => {
          // create new transaction
          await tx.transaction.create({
            data: {
              type: transaction.type,
              amount: transaction.amount,
              description: `${transaction.description} (Recurring)`,
              date: new Date(),
              category: transaction.category,
              userId: transaction.userId,
              accountId: transaction.accountId,
              isRecurring: false,
            },
          });
          // update account balance
          const balanceChange =
            transaction.type === "EXPENSE"
              ? -transaction.amount.toNumber()
              : transaction.amount.toNumber();

          await tx.account.update({
            where: { id: transaction.accountId },
            data: { balance: { increment: balanceChange } },
          });

          // update last processed date and next recurring date
          await tx.transaction.update({
            where: { id: transaction.id },
            data: {
              lastProcessed: new Date(),
              nextRecurringDate: calculateNextRecurringDate(
                new Date(),
                transaction.recurringInterval
              ),
            },
          });
        });
      });
    }
)
function isTransactionDue(transaction) {
  // if no lastProcess date, transaction is due
  if (!transaction?.lastProcessed) return true;

  const today = new Date();
  const nextDue = new Date(transaction.nextRecurringDate);

  //compare with nextDue data
  return nextDue <= today;
}

function calculateNextRecurringDate(startDate, interval) {
    const date = new Date(startDate);

    switch (interval) {
        case "DAILY":
            date.setDate(date.getDate() + 1);
            break;
        case "WEEKLY":
            date.setDate(date.getDate() + 7);
            break;
        case "MONTHLY":
            date.setMonth(date.getMonth() + 1);
            break;
        case "YEARLY":
            date.setFullYear(date.getFullYear() + 1);
            break;
        default:
            return null;
    }

    return date;
}

export const generateMonthlyReport = inngest.createFunction({
  id: "generate-monthly-report",
  name: "Generate Monthly Financial Report",
},
    { cron: "0 0 1 * *" },
    async ({ step }) => {
      const users = await step.run("fetch-users", async () => {
        return await db.user.findMany({
          include: {
            accounts: true,
          },
        });
      });
      for (const user of users) {
        await step.run(`generate-report-${user.id}`, async () => {
          const lastMonth = new Date();
          lastMonth.setMonth(lastMonth.getMonth() - 1);

          const stats = await getMonthlyStats(user.id, lastMonth);
          const monthName = lastMonth.toLocaleString("default", {
            month: "long",
          });
          const insights = await generateFinancialInsights(stats, monthName);

        await sendEmail({
          to: user.email,
            subject: `Your Monthly Financial Report ${monthName}`,
            react: EmailTemplate({
              userName: user.name,
              type: "monthly-report",
              hideHeader: true,
              data: {
                stats,
                month: monthName,
                insights,
              },
            }),
          });
        });
      }
      return { processed: users.length };
    }
  );

  async function generateFinancialInsights(stats, month) {
    if (!stats) return [];

    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      // Build category breakdown safely - use stats.categories not stats.byCategory
      const categoryBreakdown = (stats.categories && Object.keys(stats.categories).length > 0)
        ? Object.entries(stats.categories)
          .map(([category, amount]) => `${category}: $${amount}`)
          .join(", ")
        : "No expenses";

      const prompt = `
Analyze this financial data and provide 3 concise, actionable insights.
Focus on spending patterns and practical advice.
Keep it friendly and conversational.

Financial Data for ${month}:
- Total Income: $${stats.totalIncome || 0}
- Total Expenses: $${stats.totalExpense || 0}
- Net Income: $${(stats.totalIncome || 0) - (stats.totalExpense || 0)}
- Expense Categories: ${categoryBreakdown}

Format the response as a JSON array of strings, like this:
["insight 1", "insight 2", "insight 3"]
`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = await response.text();
      const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

      return JSON.parse(cleanedText);
    } catch (error) {
      console.error("Error generating insights:", error);
      // Fallback to basic insights if AI fails
      return [
        `You earned $${stats.totalIncome || 0} this month`,
        `You spent $${stats.totalExpense || 0} this month`,
        `Your net income was $${(stats.totalIncome || 0) - (stats.totalExpense || 0)} this month`,
      ];
    }
  }

async function getMonthlyStats(userId, month) {
  const startDate = new Date(month.getFullYear(), month.getMonth(), 1);
  const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0);

  const transactions = await db.transaction.findMany({
    where: {
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  return transactions.reduce(
    (stats, t) => {
      const amount = t.amount.toNumber();
      if (t.type === "INCOME") {
        stats.totalIncome += amount;
      } else if (t.type === "EXPENSE") {
        stats.totalExpense += amount;
        stats.categories[t.category] =
          (stats.categories[t.category] || 0) + amount;
      } else {
        stats.totalTransfer += amount;
      }
      return stats;
    },
    { totalIncome: 0,
      totalExpense: 0, 
      transactionCount: transactions.length, 
      categories: {},
     }
  );
}