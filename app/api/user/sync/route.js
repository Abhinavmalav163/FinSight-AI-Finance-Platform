import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { headers } from 'next/headers';

// Default response headers for JSON
const defaultHeaders = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

// Helper function to create JSON responses
function jsonResponse(data, status = 200, additionalHeaders = {}) {
  return Response.json(data, {
    status,
    headers: { ...defaultHeaders, ...additionalHeaders }
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      ...defaultHeaders,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(req) {
  // Ensure we catch any errors and return a proper JSON response
  try {
    // Read and validate the request body
    let requestBody;
    try {
      requestBody = await req.json();

      // Validate required fields if any
      if (requestBody && typeof requestBody === 'object') {
        if (requestBody.userId && typeof requestBody.userId !== 'string') {
          return jsonResponse({
            error: "Invalid request format",
            details: "userId must be a string"
          }, 400);
        }
      } else {
        return jsonResponse({
          error: "Invalid request format",
          details: "Request body must be a JSON object"
        }, 400);
      }
    } catch (parseError) {
      return jsonResponse({
        error: "Invalid JSON request body",
        details: "The request body could not be parsed as JSON"
      }, 400);
    }

    const user = await currentUser();
    if (!user) {
      return jsonResponse({
        error: "Authentication required",
        details: "No authenticated user found"
      }, 401);
    }

    // Verify the userId from request body matches the authenticated user
    if (requestBody.userId && requestBody.userId !== user.id) {
      return jsonResponse({
        error: "Forbidden",
        details: "The provided userId does not match the authenticated user"
      }, 403);
    }

    const primaryEmail = user.emailAddresses?.find(email => email.id === user.primaryEmailAddressId)?.emailAddress
      || user.emailAddresses?.[0]?.emailAddress;

    if (!primaryEmail) {
      return jsonResponse({
        error: "Validation error",
        details: "User must have a primary email address"
      }, 400);
    }

    try {
      // Check if user exists
      let dbUser = await db.user.findUnique({
        where: { clerkUserId: user.id },
      });

      const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      const userData = {
        clerkUserId: user.id,
        name: name || user.username || (dbUser?.name || 'Unknown User'),
        imageUrl: user.imageUrl || dbUser?.imageUrl,
        email: primaryEmail,
        updatedAt: new Date(),
      };

      // Create or update user
      dbUser = !dbUser
        ? await db.user.create({ data: userData })
        : await db.user.update({
            where: { clerkUserId: user.id },
            data: userData,
          });

      return jsonResponse({
        status: "success",
        message: "User synced successfully",
        data: {
          user: {
            id: dbUser.id,
            name: dbUser.name,
            email: dbUser.email,
            imageUrl: dbUser.imageUrl,
            updatedAt: dbUser.updatedAt
          }
        }
      }, 200);

    } catch (dbError) {
      console.error("Database error:", dbError);
      return jsonResponse({
        error: "Database operation failed",
        details: process.env.NODE_ENV === 'development' ? dbError.message : "An error occurred while updating user data"
      }, 500);
    }

  } catch (error) {
    console.error("Error syncing user data:", error);

    return jsonResponse({
      error: "Internal server error",
      details: process.env.NODE_ENV === 'development' ? error.message : "An unexpected error occurred",
      timestamp: new Date().toISOString()
    }, 500);
  }
}
