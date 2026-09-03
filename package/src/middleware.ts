import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 除外したい言語プレフィックスをリスト化
const EXCLUDED_LANGS = ["/en", "/zh-TW", "/sitemap"];

// ブロックしたいbotのUser-Agentパターン
// 必要に応じて追加・削除してください
const BLOCKED_BOT_PATTERNS = [
    /GPTBot/i,
    /ChatGPT-User/i,
    /CCBot/i,
    /Bytespider/i,
    /Amazonbot/i,
    /PetalBot/i,
    /SemrushBot/i,
    /AhrefsBot/i,
    /MJ12bot/i,
    /DotBot/i,
    /python-requests/i,
    /scrapy/i,
    /curl/i,
    /wget/i,
];

function isBlockedBot(userAgent: string | null): boolean {
    if (!userAgent) {
        // UAが空のリクエストもbot扱いにするかは要件次第
        return true;
    }
    return BLOCKED_BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
}

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    // Next.jsの内部リソースはスキップ
    if (pathname.startsWith("/_next") || pathname === "/favicon.ico") {
        return NextResponse.next();
    }

    // --- ここでbot判定 ---
    const userAgent = request.headers.get("user-agent");
    if (isBlockedBot(userAgent)) {
        console.warn("🚫 blocked bot UA:", userAgent, "path:", pathname);
        return new NextResponse("Forbidden", { status: 403 });
    }

    // /ja にアクセス → / にリダイレクト
    if (pathname === "/ja" || pathname.startsWith("/ja/")) {
        const url = request.nextUrl.clone();
        url.pathname = pathname.replace(/^\/ja/, "") || "/";
        console.warn("↩️ redirect to:", url.pathname);
        return NextResponse.redirect(url);
    }

    // 除外言語（/en, /zh-TWなど）はそのまま通す
    if (EXCLUDED_LANGS.some((lang) => pathname.startsWith(lang))) {
        console.info("skip rewrite for:", pathname);
        return NextResponse.next();
    }

    // それ以外（/posts など）は内部的に /ja に rewrite
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = `/ja${pathname}`;
    console.info("ewrite to:", rewriteUrl.pathname);
    return NextResponse.rewrite(rewriteUrl);
}

export const config = {
    matcher: ["/((?!_next|api|favicon.ico|images).*)"],
};
