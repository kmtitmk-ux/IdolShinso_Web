import './global.css';
import ClientThemeProvider from "./ClientThemeProvider";
import { Amplify } from 'aws-amplify';
import outputs from '@/amplify_outputs.json';
import Script from "next/script";

Amplify.configure(outputs, { ssr: true });

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ja" suppressHydrationWarning>
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
                    {/* CssBaseline kickstart an elegant, consistent, and simple baseline to build upon. */}
                    {children}
                </ClientThemeProvider>
            </body>
        </html>
    );
}
