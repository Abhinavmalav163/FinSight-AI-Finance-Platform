"use client";

import { SignedIn, SignedOut, SignInButton } from '@clerk/nextjs'
import UserButtonWrapper from './UserButtonWrapper'
import Link from 'next/link'
import Image from 'next/image'
import React from 'react'
import { Button } from '@/components/ui/button';
import { LayoutDashboard, PenBox } from 'lucide-react';

const Header = () => {
  return (
    <div className="fixed top-0 w-full bg-white/80 backdrop-blur-md shadow-md z-50 borer-b"> 
    <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/">
        <Image 
        src="/logo.png" 
        alt="FinSight logo" 
        height={60} 
        width={200}
        priority={true}
        className="h-12 w-auto object-contain" />
        </Link>
        <div className="flex items-center space-x-4">
          <SignedIn>
            <Link href={"/main/dashboard"}
            className="text-grey-800 flex items-center gap-2">
            <Button
              variant="outline"
              className="bg-black text-white hover:bg-white hover:text-black"
            >
              <LayoutDashboard size={16} />
              <span className="hidden md:inline">Dashboard</span>
            </Button>
            </Link>

             <Link href={"/main/transaction/create"}
            className="text-grey-800 flex items-center gap-2">
            <Button
              variant="outline"
              className="flex items-center gap-2 bg-black text-white hover:bg-white hover:text-black"
            >
              <PenBox size={16} />
              <span className="hidden md:inline">Add Transaction</span>
            </Button>
            </Link>
            </SignedIn>


            <SignedOut>
                <SignInButton>
                    <Button variant="outline" className="flex items-center gap-2 bg-black text-white hover:bg-white hover:text-black">Login</Button>
                </SignInButton>
            </SignedOut>
            <SignedIn>
                <UserButtonWrapper />
            </SignedIn>
        </div>
    </nav>
    </div>
  )
}

export default Header;
