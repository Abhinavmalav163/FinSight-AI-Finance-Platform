
"use server";

import { db } from "@/lib/prisma";
import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';

const serializeTransaction = (obj) => {
    const serialized = { ... obj};

    if(obj.balance){
        serialized.balance = obj.balance.toNumber();
    }

    if(obj.amount){
        serialized.amount = obj.amount.toNumber();
    }

    if(obj.transactions){
        serialized.transactions = obj.transactions.map(serializeTransaction);
    }

    return serialized;
};

// Fetch a single account and its transactions by account ID
export async function getAccountWithTransactions(accountId) {
    const { userId } = await auth();
    if (!userId) return null;

    const user = await db.user.findUnique({ where: { clerkUserId: userId } });
    if (!user) return null;

    const account = await db.account.findUnique({
            where: { id: accountId, userId: user.id },
            include: {
                transactions: {
                    orderBy: { createdAt: 'desc' },
                },
                _count: {
                    select: { transactions: true },
                },
            },
    });
    if (!account) return null;
        // Ensure transactions is always an array and serialize amounts
        const safeAccount = { ...account, transactions: account.transactions || [] };
        return serializeTransaction(safeAccount);
}

export async function createAccount(data){
    try {
        const { userId } = await auth();
        if(!userId) return { success: false, error: "User not authenticated" };

        const user = await db.user.findUnique({ where: { clerkUserId: userId } });
        if (!user) {
            return { success: false, error: "User not found" };
        }

        const balanceFloat = parseFloat(data.balance)
        if (isNaN(balanceFloat)) {
            throw new Error("Invalid balance value");   
        }

        const existingAccounts = await db.account.findMany({
            where: { userId: user.id },
        });

        const shouldBeDefault = existingAccounts.length === 0 ? true : data.isDefault;

        if (shouldBeDefault){
            await db.account.updateMany({
                where: { userId: user.id, isDefault: true },
                data: { isDefault: false },
            });
        } 
        const account = await db.account.create({
            data: {
                ...data,
                balance: balanceFloat,
                isDefault: shouldBeDefault,
                userId: user.id,
            },
        });

        const serializedAccount = serializeTransaction(account);
        revalidatePath("/main/dashboard");
        return {success:true, data: serializedAccount};
    } catch (error) {
        console.error('createAccount error', error);
        return { success: false, error: error?.message || String(error) };
    }
}
export async function getUserAccounts(){
  try {
    const { userId } = await auth();
    if(!userId) return [];

    const user = await db.user.findUnique({ where: { clerkUserId: userId } });
    if (!user) return [];

    const accounts = await db.account.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        include: {
            transactions: {
                select: {
                    id: true,
                    type: true,
                    amount: true,
                    createdAt: true
                }
            }
        }
    });
        const serializedAccount = accounts.map(serializeTransaction);
        return serializedAccount;
  } catch (error) {
    console.error('getUserAccounts error', error);
    return [];
  }
}
export async function getDashboardData() {
    const { userId } = await auth();
    if (!userId) throw new Error("User not authenticated");

    const user = await db.user.findUnique({ 
        where: { clerkUserId: userId } 
    });

    if (!user) {
        throw new Error("User not found");
    }
    const transactions = await db.transaction.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
    });
    return transactions.map(serializeTransaction);
}