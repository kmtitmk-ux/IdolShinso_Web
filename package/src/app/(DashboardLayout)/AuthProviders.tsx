// src/app/providers/AuthProviders.tsx
"use client";

import { Authenticator } from "@aws-amplify/ui-react";
import AuthSync from "@/app/(DashboardLayout)/components/forms/AuthSync";

export default function AuthProviders({ children }: { children: React.ReactNode; }) {
    return (
        <Authenticator.Provider>
            <AuthSync>{children}</AuthSync>
        </Authenticator.Provider>
    );
}
