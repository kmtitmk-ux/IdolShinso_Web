import React from "react";
import { Container, Box } from "@mui/material";
import Script from "next/script";
import ClientLayout from "@/src/app/(DashboardLayout)/ClientLayout";
import ClientThemeProvider from "@/app/ClientThemeProvider";

export default async function RootLayout({
    children,
    params
}: {
    children: React.ReactNode;
    params: { lang?: string; };
}) {
    const awaitedParams = await params;
    const { lang } = awaitedParams;
    return (
        <>
            <html lang={lang} suppressHydrationWarning>
                <head>
                    {/* Google Tag Manager */}
                    <Script id="gtm-script" strategy="afterInteractive">
                        {`
                       (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                        })(window,document,'script','dataLayer','GTM-MNJBGRD');
                    `}
                    </Script>
                </head>
                <body>
                    {/* Google Tag Manager (noscript) */}
                    <noscript dangerouslySetInnerHTML={
                        {
                            __html: `<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-MNJBGRD" height="0" width="0" style="display:none;visibility:hidden"></iframe>`
                        }
                    } />
                    {/* End Google Tag Manager (noscript) */}

                    <ClientThemeProvider>
                        <ClientLayout>
                            {/* PageContent */}
                            {/* ------------------------------------------- */}
                            <Container
                                sx={{
                                    paddingTop: "20px",
                                    maxWidth: "1200px",
                                }}
                            >
                                {/* ------------------------------------------- */}
                                {/* Page Route */}
                                {/* ------------------------------------------- */}
                                <Box sx={{ minHeight: "calc(100vh - 170px)" }}>{children}</Box>
                                {/* ------------------------------------------- */}
                                {/* End Page */}
                                {/* ------------------------------------------- */}
                            </Container>
                        </ClientLayout>
                    </ClientThemeProvider>
                </body>
            </html>
        </>
    );
}
