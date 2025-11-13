"use client";

import { UserButton } from '@clerk/nextjs';

const UserButtonWrapper = () => {
  return (
    <UserButton appearance={{
      elements: {
        avatarBox: "h-10 w-10",
        avatarImage: "h-10 w-10",
      },
    }}/>
  );
};

export default UserButtonWrapper;
