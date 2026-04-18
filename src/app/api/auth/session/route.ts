import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebase-admin";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { idToken } = body;

    if (!idToken) {
      return NextResponse.json({ error: "No ID token provided" }, { status: 401 });
    }

    // Verify the Firebase ID token
    let decoded;
    try {
      decoded = await verifyIdToken(idToken);
    } catch (verifyError) {
      console.error("Token verification failed:", verifyError);
      return NextResponse.json(
        { error: "Token verification failed: " + (verifyError instanceof Error ? verifyError.message : "Unknown error") },
        { status: 401 }
      );
    }

    if (!decoded) {
      return NextResponse.json({ error: "Invalid token: no decoded data" }, { status: 401 });
    }

    const userEmail = decoded.email;
    if (!userEmail) {
      return NextResponse.json({ error: "Invalid token: no email in token" }, { status: 401 });
    }

    const userName = decoded.name || decoded.firebase?.name || userEmail.split("@")[0];

    // Find or create user in our database
    let user = await db.user.findUnique({
      where: { email: userEmail },
      include: { subscription: true },
    });

    if (!user) {
      // Auto-create user from Firebase auth info
      const userCount = await db.user.count();
      const isFirstUser = userCount === 0;

      user = await db.user.create({
        data: {
          name: userName,
          email: userEmail,
          password: "", // Firebase users don't need local password
          role: isFirstUser ? "admin" : "user",
          plan: "free",
          creditsUsed: 0,
          creditsLimit: isFirstUser ? 999999 : 3,
          subscription: {
            create: {
              plan: isFirstUser ? "enterprise" : "free",
              status: "active",
            },
          },
        },
        include: { subscription: true },
      });
    }

    // Return user data
    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        plan: user.plan,
        creditsUsed: user.creditsUsed,
        creditsLimit: user.creditsLimit,
      },
    });
  } catch (error) {
    console.error("Session error:", error);
    return NextResponse.json(
      { error: "Session verification failed" },
      { status: 500 }
    );
  }
}
