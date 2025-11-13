"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import useFetch from "@/app/hooks/use-fetch";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import CreateAccountDrawer from "@/components/CreateAccountDrawer";
import { cn } from "@/lib/utils";
import { createTransaction, updateTransaction } from "@/actions/transaction";
import { transactionSchema } from "@/app/lib/schema";
import { ReceiptScanner } from "./receipt-scanner";

export function AddTransactionForm({
  accounts,
  categories,
  editMode = false,
  initialData = null,
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const [isDatePickerOpen, setDatePickerOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    getValues,
    reset,
    control,
  } = useForm({
    resolver: zodResolver(transactionSchema),
    defaultValues:
      editMode && initialData
        ? {
            type: initialData.type,
            amount: initialData.amount.toString(),
            description: initialData.description,
            accountId: initialData.accountId,
            category: initialData.category,
            date: new Date(initialData.date),
            isRecurring: initialData.isRecurring,
            ...(initialData.recurringInterval && {
              recurringInterval: initialData.recurringInterval,
            }),
          }
        : {
            type: "EXPENSE",
            amount: "",
            description: "",
            accountId: accounts.find((ac) => ac.isDefault)?.id,
            date: undefined,
            isRecurring: false,
          },
  });

  const {
    loading: transactionLoading,
    fn: transactionFn,
    data: transactionResult,
  } = useFetch(editMode ? updateTransaction : createTransaction);

  const onSubmit = (data) => {
    const formData = {
      ...data,
      amount: parseFloat(data.amount),
    };

    if (editMode) {
      transactionFn(editId, formData);
    } else {
      transactionFn(formData);
    }
  };

  useEffect(() => {
    if (transactionResult?.success && !transactionLoading) {
      toast.success(
        editMode
          ? "Transaction updated successfully"
          : "Transaction created successfully"
      );
      reset();
  router.push(`/main/account/${transactionResult.data.accountId}`);
    }
  }, [
    transactionResult,
    transactionLoading,
    editMode,
    router,
    reset,
  ]);

  const handleScanComplete = (scannedData) => {
    console.log("handleScanComplete called with:", scannedData);
    if (!scannedData) {
      console.log("No scannedData provided");
      return;
    }
  
    // Start with current form values
    const newValues = { ...getValues() };
  
    if (scannedData.amount !== undefined && scannedData.amount !== null) {
      console.log("Setting amount:", scannedData.amount);
      newValues.amount = String(scannedData.amount);
    }
  
    if (scannedData.date) {
      const parsed = new Date(scannedData.date);
      if (!isNaN(parsed)) {
        console.log("Setting date:", parsed);
        newValues.date = parsed;
      }
    }
  
    if (scannedData.description) {
      console.log("Setting description:", scannedData.description);
      newValues.description = scannedData.description;
    }
  
    if (scannedData.category) {
      console.log("Looking for category match for:", scannedData.category);
      const matchedCategory = categories.find(
        (cat) =>
          cat.name.toLowerCase() === scannedData.category.toLowerCase() ||
          cat.name.toLowerCase().includes(scannedData.category.toLowerCase()) ||
          scannedData.category.toLowerCase().includes(cat.name.toLowerCase())
      );
  
      if (matchedCategory) {
        console.log("Found matching category:", matchedCategory.name, "ID:", matchedCategory.id);
        newValues.type = matchedCategory.type; // Set the correct type
        newValues.category = matchedCategory.id; // Set the category
      } else {
        console.log(
          "No matching category found for:",
          scannedData.category,
          "- selecting 'Other' and adding to description"
        );
        // Determine the transaction type. Default to EXPENSE for unknown categories.
        const transactionType = newValues.type || "EXPENSE";
        const otherCategory = categories.find(
          (cat) =>
            cat.name.toLowerCase() === "other" && cat.type === transactionType
        );
        if (otherCategory) {
          newValues.category = otherCategory.id;
          newValues.type = otherCategory.type;
        }
  
        // Always append the AI-detected category to the description for user reference
        const currentDescription = newValues.description || "";
        const newDescription = currentDescription
          ? `${currentDescription} (${scannedData.category})`
          : scannedData.category;
        newValues.description = newDescription;
      }
    }
  
    // Reset the form with all new values at once
    reset(newValues);
  };

  const type = watch("type");
  const isRecurring = watch("isRecurring");
  const date = watch("date");
  

  const filteredCategories = (categories || []).filter(
    (category) => category.type === type
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Receipt Scanner - Only show in create mode */}
      {!editMode && <ReceiptScanner onScanComplete={handleScanComplete} />}

      {/* Type */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-left block">Type</label>
        <Select
          onValueChange={(value) => setValue("type", value)}
          defaultValue={type}
        >
          <SelectTrigger className="w-full text-left">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent className="bg-black text-white flex">
            <SelectItem value="EXPENSE">Expense</SelectItem>
            <SelectItem value="INCOME">Income</SelectItem>
          </SelectContent>
        </Select>
        {errors.type && (
          <p className="text-sm text-red-500">{errors.type.message}</p>
        )}
      </div>

      {/* Amount and Account */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-left block">Amount</label>
          <Controller
            name="amount"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                type="number"
                step="0.01"
                placeholder="0.00"
                onChange={(e) => field.onChange(e.target.value)}
                value={field.value || ""}
              />
            )}
          />

          {errors.amount && (
            <p className="text-sm text-red-500">{errors.amount.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-left block">Account</label>
          <Select
            onValueChange={(value) => setValue("accountId", value)}
            defaultValue={getValues("accountId")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent className="bg-black text-white">
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name} (${parseFloat(account.balance).toFixed(2)})
                </SelectItem>
              ))}
              <CreateAccountDrawer>
                <Button
                  variant="ghost"
                  className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                >
                  Create Account
                </Button>
              </CreateAccountDrawer>
            </SelectContent>
          </Select>
          {errors.accountId && (
            <p className="text-sm text-red-500">{errors.accountId.message}</p>
          )}
        </div>
      </div>

      {/* Category */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-left block">Category</label>
        <Controller
          name="category"
          control={control}
          render={({ field }) => (
            <Select
              key={type} // Add key to force re-render when type changes
              onValueChange={field.onChange}
              value={field.value || ""}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent className="bg-black text-white">
                {filteredCategories.length > 0 ? (
                  filteredCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-categories" disabled>No categories available for this type</SelectItem>
                )}
              </SelectContent>
            </Select>
          )}
        />
        {errors.category && (
          <p className="text-sm text-red-500">{errors.category.message}</p>
        )}
      </div>

      {/* Date */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-left block">Date</label>
        <div className="relative">
          <Controller
            name="date"
            control={control}
            render={({ field }) => (
              <Input
                placeholder="Pick a date"
                value={field.value ? format(field.value, "PPP") : ""}
                onClick={() => setDatePickerOpen((prev) => !prev)}
                readOnly
                className="w-full pl-3 pr-10 text-left font-normal cursor-pointer"
              />
            )}
          />
          <CalendarIcon
            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 cursor-pointer"
            onClick={() => setDatePickerOpen((prev) => !prev)}
          />
        </div>
        {isDatePickerOpen && (
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(date) => {
                if (date) {
                  setValue("date", date);
                }
                setDatePickerOpen(false);
              }}
              initialFocus
            />
          </div>
        )}
        {errors.date && (
          <p className="text-sm text-red-500">{errors.date.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-left block">Description</label>
        <Input placeholder="Enter description" {...register("description")} />
        {errors.description && (
          <p className="text-sm text-red-500">{errors.description.message}</p>
        )}
      </div>

      {/* Recurring Toggle */}
      <div className="flex flex-row items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5 text-left">
          <label className="text-base font-medium">Recurring Transaction</label>
          <div className="text-sm text-muted-foreground">
            Set up a recurring schedule for this transaction
          </div>
        </div>
        <Switch
          checked={isRecurring}
          onCheckedChange={(checked) => setValue("isRecurring", checked)}
        />
      </div>

      {/* Recurring Interval */}
      {isRecurring && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-left block">Recurring Interval</label>
          <Select
            onValueChange={(value) => setValue("recurringInterval", value)}
            defaultValue={getValues("recurringInterval")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select interval" />
            </SelectTrigger>
            <SelectContent className="bg-black text-white">
              <SelectItem value="DAILY">Daily</SelectItem>
              <SelectItem value="WEEKLY">Weekly</SelectItem>
              <SelectItem value="MONTHLY">Monthly</SelectItem>
              <SelectItem value="YEARLY">Yearly</SelectItem>
            </SelectContent>
          </Select>
          {errors.recurringInterval && (
            <p className="text-sm text-red-500">
              {errors.recurringInterval.message}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="outline"
          disabled={transactionLoading}
        >
          {transactionLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {editMode ? "Updating..." : "Creating..."}
            </>
          ) : editMode ? (
            "Update Transaction"
          ) : (
            "Create Transaction"
          )}
        </Button>
      </div>
    </form>
  );
}

    export default AddTransactionForm;