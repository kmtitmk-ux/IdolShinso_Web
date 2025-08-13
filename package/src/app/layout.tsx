import './global.css';
import ClientThemeProvider from "./ClientThemeProvider";
import { Amplify } from 'aws-amplify';
import outputs from '@/amplify_outputs.json';

Amplify.configure(outputs);

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ja">
            <body>
                <ClientThemeProvider>
                    {/* CssBaseline kickstart an elegant, consistent, and simple baseline to build upon. */}
                    {children}
                </ClientThemeProvider>
            </body>
        </html>
    );
}
