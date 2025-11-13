"use server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { GoogleGenerativeAI } from "@google/generative-ai";
import aj from "@/lib/arcjet";
import { request } from "@arcjet/next";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const serializeAmount = (obj) => ({
    ...obj,
    amount: obj.amount.toNumber(),
});

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

async function protectAction() {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "User not authenticated" };

    if (process.env.ARCJET_KEY) {
        try {
            const req = await request();
            const decision = await aj.protect(req, { userId, requested: 1 });
            if (decision && typeof decision.isDenied === "function" && decision.isDenied()) {
                return { success: false, error: "Forbidden: Rate limit exceeded." };
            }
        } catch (err) {
            console.error("Arcjet protect error (non-fatal):", err);
        }
    }

    return { success: true, userId };
}

export async function createTransaction(data) {
    const protection = await protectAction();
    if (!protection.success) return protection;

    const { userId } = protection;

    try {
        const user = await db.user.findUnique({ where: { clerkUserId: userId } });
        if (!user) return { success: false, error: "User not found" };

        const account = await db.account.findUnique({ where: { id: data.accountId, userId: user.id } });
        if (!account) return { success: false, error: "Account not found" };

        const balanceChange = data.type === "EXPENSE" ? -data.amount : data.amount;
        const newBalance = account.balance.toNumber() + balanceChange;

        const transaction = await db.$transaction(async (tx) => {
            const newTransaction = await tx.transaction.create({
                data: {
                    ...data,
                    userId: user.id,
                    nextRecurringDate:
                        data.isRecurring && data.recurringInterval
                            ? calculateNextRecurringDate(data.date, data.recurringInterval)
                            : null,
                },
            });

            await tx.account.update({ where: { id: data.accountId }, data: { balance: newBalance } });

            return newTransaction;
        });

        revalidatePath("/main/dashboard");
        revalidatePath(`/main/account/${transaction.accountId}`);

        return { success: true, data: serializeAmount(transaction) };
    } catch (error) {
        console.error("createTransaction error:", error);
        return { success: false, error: error?.message || String(error) };
    }
}

export async function getTransaction(id) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "User not authenticated" };

    const user = await db.user.findUnique({ where: { clerkUserId: userId } });
    if (!user) return { success: false, error: "User not found" };

    const transaction = await db.transaction.findUnique({ where: { id, userId: user.id } });
    if (!transaction) return { success: false, error: "Transaction not found" };

    return { success: true, data: serializeAmount(transaction) };
}

export async function updateTransaction(id, data) {
    const protection = await protectAction();
    if (!protection.success) return protection;
    const { userId } = protection;

    try {
        const user = await db.user.findUnique({ where: { clerkUserId: userId } });
        if (!user) return { success: false, error: "User not found" };

        const originalTransaction = await db.transaction.findUnique({ where: { id, userId: user.id }, include: { account: true } });
        if (!originalTransaction) return { success: false, error: "Transaction not found" };

        const oldBalanceChange = originalTransaction.type === "EXPENSE" ? -originalTransaction.amount.toNumber() : originalTransaction.amount.toNumber();
        const newBalanceChange = data.type === "EXPENSE" ? -data.amount : data.amount;
        const netBalanceChange = newBalanceChange - oldBalanceChange;

        const transaction = await db.$transaction(async (tx) => {
            const updated = await tx.transaction.update({ where: { id, userId: user.id }, data: { ...data, nextRecurringDate: data.isRecurring && data.recurringInterval ? calculateNextRecurringDate(data.date, data.recurringInterval) : null } });

            await tx.account.update({ where: { id: data.accountId }, data: { balance: { increment: netBalanceChange } } });

            return updated;
        });

        revalidatePath("/main/dashboard");
        revalidatePath(`/main/account/${data.accountId}`);

        return { success: true, data: serializeAmount(transaction) };
    } catch (error) {
        console.error("updateTransaction error:", error);
        return { success: false, error: error?.message || String(error) };
    }
}

export async function getUserTransactions(query = {}) {
    try {
        const { userId } = await auth();
        if (!userId) return { success: false, error: "User not authenticated" };

        const user = await db.user.findUnique({ where: { clerkUserId: userId } });
        if (!user) return { success: false, error: "User not found" };

        const transactions = await db.transaction.findMany({ where: { userId: user.id, ...query }, include: { account: true }, orderBy: { date: "desc" } });

        return { success: true, data: transactions };
    } catch (error) {
        console.error("getUserTransactions error:", error);
        return { success: false, error: error?.message || String(error) };
    }
}

// Accept either a File/Blob or a FormData containing `file`
export async function scanReceipt(input) {
    const protection = await protectAction();
    if (!protection.success) return protection;

    // Log protection/user for debugging
    try {
        console.log('scanReceipt: protection result', JSON.stringify({ success: protection.success, userId: protection.userId }));
    } catch (e) {
        console.log('scanReceipt: protection result (compact) ', { success: protection.success, userId: protection.userId });
    }

    if (!process.env.GEMINI_API_KEY) {
        console.error("GEMINI_API_KEY is not set");
        return { success: false, error: "AI service is not configured." };
    }

    try {
        // Normalize input to a File-like object
        let file = null;
        if (input instanceof FormData) {
            file = input.get("file");
        } else if (input && input.arrayBuffer) {
            file = input;
        } else if (input && input.buffer) {
            // node buffer-like object
            file = input;
        } else {
            return { success: false, error: "No file provided to scanReceipt." };
        }

        if (!file) return { success: false, error: "No file provided to scanReceipt." };

        // Convert to base64
        let base64String;
        if (typeof file === "string") {
            base64String = file;
        } else if (file.arrayBuffer) {
            const ab = await file.arrayBuffer();
            console.log('scanReceipt: file arrayBuffer length', ab && ab.byteLength, 'type', file.type);
            base64String = Buffer.from(ab).toString("base64");
        } else if (file.buffer) {
            console.log('scanReceipt: file.buffer length', file.buffer && file.buffer.length, 'type', file.type);
            base64String = Buffer.from(file.buffer).toString("base64");
        } else {
            return { success: false, error: "Unsupported file type." };
        }

                // Use preferred model; allow override via GEMINI_MODEL
                const preferredModel = process.env.GEMINI_MODEL || "gemini-1.5-flash";

                // Prompt used to instruct the AI to extract structured JSON from the receipt image
                const prompt = `
                    You are an expert AI assistant specialized in extracting financial information from receipt images. Your task is to carefully analyze the provided receipt image and extract specific details into a JSON object.

                    Look for and extract these exact fields:
                    - "amount": The total amount paid (usually at the bottom, labeled as "Total", "Amount Due", or similar). Return as a number, e.g., 25.99. If there are taxes or tips included, use the final total.
                    - "date": The transaction date. Look for date formats like MM/DD/YYYY, DD/MM/YYYY, or written dates. Convert to ISO format: "YYYY-MM-DDTHH:mm:ss.sssZ". If no time is shown, use "00:00:00.000Z".
                    - "description": A short description of the purchase (e.g., "Grocery shopping", "Restaurant meal", "Gas station fuel").
                    - "merchantName": The business name (e.g., "Walmart", "McDonald's", "Shell").
                    - "category": Classify the purchase into one of these categories: Food, Transportation, Entertainment, Utilities, Healthcare, Shopping, Groceries, Dining, Travel, Education, Personal Care, Home & Garden, Electronics, Clothing, Other.

                    Important rules:
                    - Scan the entire receipt thoroughly for text, numbers, and logos.
                    - If a field cannot be found, set it to null.
                    - Return ONLY the JSON object, nothing else.
                    - Do not add explanations, markdown, or extra text.
                    - Ensure the JSON is valid and parseable.

                    Examples:
                    For a grocery receipt: {"amount": 45.67, "date": "2023-10-15T00:00:00.000Z", "description": "Weekly groceries", "merchantName": "Safeway", "category": "Groceries"}
                    For a restaurant receipt: {"amount": 32.50, "date": "2023-10-14T00:00:00.000Z", "description": "Dinner with friends", "merchantName": "Olive Garden", "category": "Dining"}
                    For a gas receipt: {"amount": 55.00, "date": "2023-10-13T00:00:00.000Z", "description": "Fuel for car", "merchantName": "Chevron", "category": "Transportation"}
                `;
        let result = null;
        let usedModel = null;
        let lastError = null;


        // Try preferredModel first
        try {
            const model = genAI.getGenerativeModel({ model: preferredModel });
            console.log("scanReceipt: trying model", preferredModel);
            result = await model.generateContent([
                { inlineData: { data: base64String, mimeType: file.type || "image/jpeg" } },
                prompt,
            ]);
            usedModel = preferredModel;
        } catch (err) {
            console.warn("scanReceipt: preferred model failed:", err && (err.message || err));
            lastError = err;
        }

        // If preferred fails, try listModels and attempt available models.
        if (!result) {
            try {
                const listResp = await genAI.listModels();
                // Log full response for debugging (trim large outputs in prod)
                console.log("scanReceipt: listModels response:", JSON.stringify(listResp).slice(0, 2000));

                const available = Array.isArray(listResp)
                    ? listResp
                    : (listResp && Array.isArray(listResp.models) ? listResp.models : []);

                // Helper: detect if model object likely supports generateContent/vision
                const likelySupportsGenerateContent = (m) => {
                    if (!m) return false;
                    // common candidate name fields
                    const id = (m.name || m.id || m.modelId || (typeof m === 'string' ? m : '') || '').toString();
                    const str = id.toLowerCase();

                    // Check explicit supported fields
                    const checkArrays = [m.supportedMethods, m.supportedGenerationMethods, m.supportedResponseTypes, m.methods, m.features, m.capabilities, m.supported_modalities, m.supported_modalities];
                    for (const arr of checkArrays) {
                        if (Array.isArray(arr)) {
                            for (const v of arr) {
                                const s = (v || '').toString().toLowerCase();
                                if (s.includes('generatecontent') || s.includes('generate') || s.includes('vision') || s.includes('image') || s.includes('gimg')) return true;
                            }
                        } else if (typeof arr === 'string') {
                            const s = arr.toLowerCase();
                            if (s.includes('generatecontent') || s.includes('generate') || s.includes('vision') || s.includes('image') || s.includes('gimg')) return true;
                        }
                    }

                    // Name-based heuristics
                    if (str.includes('vision') || str.includes('gimg') || str.includes('image') || str.includes('vision')) return true;
                    // typical text-only models less likely: 'text-' prefix
                    if (str.startsWith('text-') && !str.includes('vision') && !str.includes('image')) return false;

                    return false;
                };

                const modelsList = available.map((m) => {
                    const name = m && (m.name || m.id || m.modelId) ? (m.name || m.id || m.modelId) : (typeof m === 'string' ? m : undefined);
                    return { raw: m, name };
                }).filter((x) => x.name);
                // Collect simple names for error messages if needed
                var availableModelNames = modelsList.map((m) => m.name);

                const preferredCandidates = modelsList.filter((m) => likelySupportsGenerateContent(m.raw)).map((m) => m.name);
                const fallbackCandidates = modelsList.map((m) => m.name).filter((n) => !preferredCandidates.includes(n));

                const candidates = [...preferredCandidates, ...fallbackCandidates].slice(0, 20);
                console.log('scanReceipt: candidate models to try:', candidates);

                for (const candidate of candidates) {
                    try {
                        const model = genAI.getGenerativeModel({ model: candidate });
                        console.log("scanReceipt: trying available model", candidate);
                        result = await model.generateContent([
                            { inlineData: { data: base64String, mimeType: file.type || "image/jpeg" } },
                            prompt,
                        ]);
                        usedModel = candidate;
                        break;
                    } catch (mErr) {
                        console.warn("scanReceipt: candidate failed:", candidate, mErr && (mErr.message || mErr));
                    }
                }
            } catch (lmErr) {
                console.warn("scanReceipt: listModels failed:", lmErr && (lmErr.message || lmErr));
            }
        }

        if (!result) {
            const msg = lastError && (lastError.message || String(lastError)) ? (lastError.message || String(lastError)) : "No AI model available.";
            console.error("scanReceipt: no model succeeded:", msg);
            const suffix = (typeof availableModelNames !== 'undefined' && Array.isArray(availableModelNames) && availableModelNames.length)
                ? ` Available models: ${availableModelNames.join(', ')}`
                : '';
            return { success: false, error: `AI model error: ${msg}${suffix}` };
        }

        const response = await result.response;
        let text = "";
        try {
            text = await response.text();
        } catch (e) {
            console.error("scanReceipt: failed to read response text", e);
            return { success: false, error: "AI returned unreadable response." };
        }

        let cleaned = String(text || "").replace(/```(?:json)?\\n?/g, "").trim();
        console.log("scanReceipt: used model", usedModel);
        console.log("scanReceipt: raw AI response text:", text);
        console.log("scanReceipt: cleaned text:", cleaned);

        // Extract JSON from the response using regex if it contains extra text
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            cleaned = jsonMatch[0];
        }

        try {
            const data = JSON.parse(cleaned || "{}");
            // Return only serializable fields (dates as ISO strings)
            const payload = {
                amount: data.amount != null ? parseFloat(data.amount) : null,
                date: data.date ? (new Date(data.date)).toISOString() : null,
                description: data.description || data.merchantName || "",
                category: data.category || null,
                merchantName: data.merchantName || null,
            };

            return { success: true, data: payload };
        } catch (parseErr) {
            console.error("scanReceipt: parse error", parseErr, "cleaned text:", cleaned);
            return { success: false, error: "Invalid response format from AI" };
        }
    } catch (error) {
        console.error("scanReceipt error:", error);
        return { success: false, error: error?.message || String(error) };
    }
}