"use server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const serializeTransaction = (obj) => {
    const serialized = { ... obj};

    if(obj.balance){
        serialized.balance = obj.balance.toNumber();
    }

    if(obj.amount){
        serialized.amount = obj.amount.toNumber();
    }

    return serialized;
};

export async function updateDefaultAccount(accountId){
try{
    const { userId } = await auth();
        if(!userId) throw new Error("User not authenticated");

        const user = await db.user.findUnique({
            where: { clerkUserId: userId },
        });

        if (!user) {
            throw new Error("User not found");
        }

        await db.account.updateMany({
                where: { userId: user.id, isDefault: true },
                data: { isDefault: false },
            });

        const account = await db.account.update({
            where: { id: accountId, userId: user.id },
            data: { isDefault: true },
        })

        revalidatePath('/dashboard');
        return { success: true, account: serializeTransaction(account) }
    }    catch(error){
        return { success: false, error: error.message };
    }
}
export async function getAccountWithTransaction(accountId){
    try {
        const { userId } = await auth();
        if(!userId) throw new Error("User not authenticated");

        const user = await db.user.findUnique({
            where: { clerkUserId: userId },
        });

        if (!user) {
            throw new Error("User not found");
        }

        const account = await db.account.findFirst({
            where: { 
                id: accountId,
                userId: user.id 
            },
            include: {
                transactions: {
                    orderBy: { 
                        createdAt: 'desc' 
                    },
                    select: {
                        id: true,
                        amount: true,
                        type: true,
                        category: true,
                        description: true,
                        date: true,
                        createdAt: true,
                        isRecurring: true,
                        recurringInterval: true,
                        nextRecurringDate: true
                    }
                },
                _count: {
                    select: {
                        transactions: true
                    }
                }
            }
        });

        if(!account) {
            console.log('Account not found:', accountId);
            return { success: false, error: "Account not found" };
        }

        const serializedAccount = {
            ...serializeTransaction(account),
            transactions: account.transactions.map(serializeTransaction)
        };

        console.log('Found account:', {
            id: account.id,
            transactionCount: account.transactions.length
        });

        return {
            success: true,
            account: serializedAccount
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export async function bulkDeleteTransactions(transactionIds) {
    try {
        const { userId } = await auth();
        if(!userId) throw new Error("User not authenticated");

        const user = await db.user.findUnique({
            where: { clerkUserId: userId },
        });

        if (!user) {
            throw new Error("User not found");
        }

        // First, verify all transactions belong to the user
        const transactions = await db.transaction.findMany({
            where: {
                id: { in: transactionIds },
                account: {
                    userId: user.id
                }
            }
        });

        if (transactions.length !== transactionIds.length) {
            throw new Error("Some transactions were not found or do not belong to this user");
        }

        // Delete the transactions
        await db.transaction.deleteMany({
            where: {
                id: { in: transactionIds },
                account: {
                    userId: user.id
                }
            }
        });

        revalidatePath('/main/account/[id]');
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}