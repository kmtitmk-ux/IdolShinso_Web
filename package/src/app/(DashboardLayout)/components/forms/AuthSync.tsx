// components/AuthSync.tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Hub } from "aws-amplify/utils";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { getCurrentUser, fetchUserAttributes } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/../amplify/data/resource";

const client = generateClient<Schema>({ authMode: "userPool" });

type DbUser = Schema["IsUsers"]["type"];

const UserContext = createContext<{ dbUser: DbUser | null; loading: boolean; }>({
    dbUser: null,
    loading: true,
});

export const useDbUser = () => useContext(UserContext);

export function safeRedirect(path: string | null) {
    if (path && /^\/(?![/\\])/.test(path)) return path;
    return "/";
}

let pendingRedirect: string | null = null;
Hub.listen("auth", ({ payload }) => {
    if (payload.event === "customOAuthState") {
        pendingRedirect = payload.data as string;
    }
});

async function ensureUserRecord(): Promise<DbUser | null> {
    const { userId } = await getCurrentUser();
    const attrs = await fetchUserAttributes();
    const { data: existing } = await client.models.IsUsers.get({ id: userId });
    if (existing) return existing;
    const { data: created } = await client.models.IsUsers.create({
        id: userId,
        email: attrs.email ?? "",
        plan: "free",
        createdAt: new Date().toISOString(),
        role: "user",
    });
    return created;
}

export default function AuthSync({ children }: { children?: React.ReactNode; }) {
    const router = useRouter();
    const { authStatus } = useAuthenticator((ctx) => [ctx.authStatus]);
    const [dbUser, setDbUser] = useState<DbUser | null>(null);
    const [loading, setLoading] = useState(true);

    // リダイレクト処理(変更なし)
    useEffect(() => {
        if (pendingRedirect) {
            const to = safeRedirect(pendingRedirect);
            pendingRedirect = null;
            router.replace(to);
        }
        const unlisten = Hub.listen("auth", ({ payload }) => {
            if (payload.event === "customOAuthState") {
                router.replace(safeRedirect(payload.data as string));
            }
        });
        return unlisten;
    }, [router]);

    // 登録 + 取得
    useEffect(() => {
        if (authStatus === "authenticated") {
            setLoading(true);
            ensureUserRecord()
                .then(setDbUser)
                .catch((e) => console.error("[ensureUserRecord]", e))
                .finally(() => setLoading(false));
        } else if (authStatus === "unauthenticated") {
            setDbUser(null);
            setLoading(false);
        }
        // "configuring" の間は loading のまま
    }, [authStatus]);
    return <UserContext.Provider value={{ dbUser, loading }}>{children}</UserContext.Provider>;
}
