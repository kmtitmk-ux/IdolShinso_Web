import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 除外したい言語プレフィックスをリスト化
const EXCLUDED_LANGS = ["/en", "/zh-TW", "/sitemap"];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    // Next.jsの内部リソースはスキップ
    if (pathname.startsWith("/_next") || pathname === "/favicon.ico") {
        return NextResponse.next();
    }
    // /ja にアクセス → / にリダイレクト
    if (pathname === "/ja" || pathname.startsWith("/ja/")) {
        const url = request.nextUrl.clone();
        url.pathname = pathname.replace(/^\/ja/, "") || "/";
        console.log("↩️ redirect to:", url.pathname);
        return NextResponse.redirect(url);
    }
    // 除外言語（/en, /zh-TWなど）はそのまま通す
    if (EXCLUDED_LANGS.some((lang) => pathname.startsWith(lang))) {
        console.log("skip rewrite for:", pathname);
        return NextResponse.next();
    }
    // それ以外（/posts など）は内部的に /ja に rewrite
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = `/ja${pathname}`;
    console.log("ewrite to:", rewriteUrl.pathname);
    return NextResponse.rewrite(rewriteUrl);
}

export const config = {
    matcher: ["/((?!_next|api|favicon.ico|images).*)"],
};
