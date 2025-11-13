"use client"
import React, { useState, useEffect } from 'react'
import { 
  Drawer, 
  DrawerClose,
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerTrigger 
} from './ui/drawer';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { accountSchema } from '@/app/lib/schema';
import { Input } from './ui/input';
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import useFetch from '@/app/hooks/use-fetch';
import { createAccount } from '@/actions/dashboard';
import { Loader2 } from 'lucide-react';
import { toast } from "sonner";

const CreateAccountDrawer = ({children, onSuccess}) => {
  const [open, setOpen] = useState(false);
  const [hasShownToast, setHasShownToast] = useState(false);
  
  const { 
    register,
    handleSubmit, 
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: '',
      type: 'CURRENT',
      balance: "0",
      isDefault: false,
    },
  });

  const {
    data: newAccount,
    error,
    fn: createAccountFn, 
    loading: createAccountLoading
  } = useFetch(createAccount);

  useEffect(() => {
    if (!hasShownToast && newAccount && !createAccountLoading) {
      toast.success("Account created successfully");
      reset();
      setOpen(false);
      setHasShownToast(true);
      if (onSuccess) {
        onSuccess();
      }
    }
  }, [newAccount, createAccountLoading, onSuccess, hasShownToast]);

  useEffect(() => {
    if (error) {
      toast.error(error.message || 'Failed to create account');
    }
  }, [error]);

  useEffect(() => {
    if (open) {
      setHasShownToast(false);
    }
  }, [open]);

  const onSubmit = async (formData) => {
    await createAccountFn(formData);
  };

  return (
<Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent className="bg-white h-[85vh] outline-none">
        <DrawerHeader className="border-b">
          <DrawerTitle className="text-xl font-semibold">Create New Account</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-4 pt-4 bg-white overflow-y-auto">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <label
                htmlFor="name"
                className="text-sm font-semibold text-gray-700 block"
              >
                Account Name
              </label>
              <Input
                id="name"
                className="w-full p-2 border rounded-md bg-white"
                placeholder="e.g., Main Checking"
                suppressHydrationWarning
                {...register("name")}
              />
              {errors.name && (
                <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="type"
                className="text-sm font-semibold text-gray-700 block"
              >
                Account Type
              </label>
              <Select
                onValueChange={(value) => setValue("type", value)}
                defaultValue={watch("type")}
              >
                <SelectTrigger id="type" className="w-full bg-white" suppressHydrationWarning>
                  <SelectValue placeholder="Select account type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CURRENT" className="bg-black text-white">Current Account</SelectItem>
                  <SelectItem value="SAVINGS" className="bg-black text-white">Savings Account</SelectItem>
                </SelectContent>
              </Select>
              {errors.type && (
                <p className="text-sm text-red-500 mt-1">{errors.type.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="balance"
                className="text-sm font-semibold text-gray-700 block"
              >
                Initial Balance
              </label>
              <Input
                id="balance"
                type="number"
                step="0.01"
                className="w-full p-2 border rounded-md bg-white"
                placeholder="Enter initial balance (e.g., 1000.00)"
                suppressHydrationWarning
                {...register("balance")}
              />
              {errors.balance && (
                <p className="text-sm text-red-500 mt-1">{errors.balance.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4 bg-gray-50">
              <div className="space-y-1">
                <label
                  htmlFor="isDefault"
                  className="text-sm font-semibold text-gray-700 block"
                >
                  Set as Default Account
                </label>
                <p className="text-sm text-gray-600">
                  This account will be pre-selected for new transactions
                </p>
              </div>
              <Switch
                id="isDefault"
                checked={watch("isDefault")}
                onCheckedChange={(checked) => setValue("isDefault", checked)}
              />
            </div>
             <div className="flex gap-4 pt-6 border-t mt-6">
              <DrawerClose asChild>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1 text-base font-medium"
                >
                  Cancel
                </Button>
              </DrawerClose>
              <Button
                type="submit"
                className="flex-1 text-base font-medium bg-black hover:bg-gray-800 text-white"
              >
                {createAccountLoading?(<><Loader2 className='m-2 h-4 w-4 animate-spin'/>Creating...</>) : ( "Create Account")}
              </Button>
            </div>
          </form>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

export default CreateAccountDrawer
