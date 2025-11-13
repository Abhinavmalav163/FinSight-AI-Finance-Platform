
import { currentUser } from "@clerk/nextjs/server";
import { db } from "./prisma";

export const checkUser = async () => {
  const user = await currentUser();

  if (!user) {
    return null;
  }

  try {
    let loggedInUser = await db.user.findUnique({
      where: {
        clerkUserId: user.id,
      },
    });

    const primaryEmail = user.emailAddresses?.[0]?.emailAddress || user.primaryEmailAddress?.emailAddress;

    if (!primaryEmail) {
      console.error("User has no email address");
      return null;
    }

    if (loggedInUser) {
      // Update user data if email or other info has changed
      if (loggedInUser.email !== primaryEmail || 
          loggedInUser.imageUrl !== user.imageUrl || 
          loggedInUser.name !== `${user.firstName || ''} ${user.lastName || ''}`.trim()) {
        
        loggedInUser = await db.user.update({
          where: { clerkUserId: user.id },
          data: {
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || loggedInUser.name,
            imageUrl: user.imageUrl,
            email: primaryEmail,
            updatedAt: new Date(),
          },
        });
      }
      return loggedInUser;
    }

    // Create new user
    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    const newUser = await db.user.create({
      data: {
        clerkUserId: user.id,
        name: name || user.username || 'Unknown User',
        imageUrl: user.imageUrl,
        email: primaryEmail,
        updatedAt: new Date(),
      },
    });

    return newUser;
  } catch (error) {
    console.error("Error checking/updating user:", error);
    return null;
  }
};
