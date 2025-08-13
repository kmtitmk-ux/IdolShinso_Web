"use client";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { baselightTheme } from "@/utils/theme/DefaultColors";

export default function ClientThemeProvider({ children }: { children: React.ReactNode; }) {
    return (
        <ThemeProvider theme={baselightTheme}>
            <CssBaseline />
            {children}
        </ThemeProvider>
    );
}
