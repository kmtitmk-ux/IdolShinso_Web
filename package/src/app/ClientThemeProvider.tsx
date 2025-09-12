"use client";

import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { baselightTheme } from "@/utils/theme/DefaultColors";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";

const createEmotionCache = () => createCache({ key: "mui", prepend: true });
const clientSideEmotionCache = createEmotionCache();

export default function ClientThemeProvider({
    children,
    emotionCache = clientSideEmotionCache,
}: {
    children: React.ReactNode;
    emotionCache?: ReturnType<typeof createEmotionCache>;
}) {
    return (
        <CacheProvider value={emotionCache}>
            <ThemeProvider theme={baselightTheme}>
                <CssBaseline />
                {children}
            </ThemeProvider>
        </CacheProvider>
    );
}
