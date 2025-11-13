"use client";
import { getAccountWithTransactions } from '@/actions/dashboard';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import React from 'react'
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const DashboardOverview = ({ accounts, transactions}) => {
    // Ensure accounts is an array
    const accountList = Array.isArray(accounts) ? accounts : [];
    const transactionList = Array.isArray(transactions) ? transactions : [];

  const [selectedAccount, setSelectedAccount] = useState(null);

    const filteredTransactions = selectedAccount === "all" || selectedAccount === null
        ? transactionList
        : transactionList.filter((tx) => tx.accountId === selectedAccount);

    const recentTransactions = filteredTransactions
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);

    // Pie chart data for expenses
    const pieChartData = transactionList
        .filter((tx) => tx.type === "EXPENSE")
        .reduce((acc, tx) => {
            const category = tx.category || "Other";
            const existing = acc.find((item) => item.name === category);
            if (existing) {
                existing.value += tx.amount;
            } else {
                acc.push({ name: category, value: tx.amount });
            }
            return acc;
        }, []);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

    // Get the display name for selected account
    const getDisplayName = () => {
      if (!selectedAccount) return "Select account";
      if (selectedAccount === "all") return "All Accounts";
      return accountList.find((acc) => acc.id === selectedAccount)?.name || "Select account";
    };
  return (
    <div className="grid gap-4 md:grid-cols-2">
        <Card>
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
    <CardTitle className="text-base font-normal">
        Recent Transaction
    </CardTitle>
    <Select
      value={selectedAccount || ""}
      onValueChange={setSelectedAccount}
    >
      <SelectTrigger className={`w-[180px] rounded-md shadow-sm transition-all ${
        selectedAccount
          ? "bg-white text-black border-none"
          : "border border-gray-300 hover:border-gray-400"
      }`}>
        <SelectValue placeholder="Select account" />
      </SelectTrigger>
      <SelectContent className="min-w-[180px] bg-black text-white">
        {accountList.map((account) => (
          <SelectItem key={account.id} value={account.id}>
            {account.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
        {recentTransactions.length === 0 ? (
            <p className="text-sm text-gray-500">
                No transactions found.
            </p>
        ) : (
            recentTransactions.map((transaction) => (
            <div
                key={transaction.id}
                className="flex items-center justify-between"
            >
                <div className="text-left">
                    <p className="text-sm font-medium leading-none">
                        {transaction.description || "Untitled Transaction"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {format(new Date(transaction.date), "PP")}
                    </p>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                    <div
                    className={cn(
                        "flex items-center",
                        transaction.type === "EXPENSE"
                        ?"text-red-500"
                        :"text-green-500"
                    )}
                    >
                        {transaction.type === "EXPENSE" ? (
                            <ArrowDownRight className = "mr-1 h-4 w-4"/>
                        ): (
                            <ArrowUpRight className = "mr-1 h-4 w-4"/>
                        )}
                        ${transaction.amount.toFixed(2)}
                    </div>

                </div>
             </div>
        ))
        )}
    </div>
  </CardContent>

</Card>

<Card>
  <CardHeader>
    <CardTitle className = "text-base font-normal">
        Monthly expense Breakdown
    </CardTitle>
  </CardHeader>
  {/* Ensure the CardContent has a proper height so ResponsiveContainer can fill it */}
  <CardContent className="p-0 pb-5">
    {pieChartData.length === 0 ? (
        <p className="text-center text-muted-foreground py-4">
            No Expenses this month.
        </p>
    ) : (
        <div className="w-full h-96">
          <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 20, right: 80, bottom: 80, left: 80 }}>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="45%"
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, value }) => `${name}: $${value.toFixed(2)}`}
                    labelLine={true}
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => `$${value.toFixed(2)}`}
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
             </ResponsiveContainer>
        </div>
    )}
  </CardContent>

</Card>
    </div>
  )
}

export default DashboardOverview;
