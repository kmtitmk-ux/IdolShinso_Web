import './global.css';
import { Amplify } from 'aws-amplify';
import outputs from '@/amplify_outputs.json';
Amplify.configure(outputs, { ssr: true });

export default async function RootLayout({ children }: { children: React.ReactNode; }) {
    return (
        <>
            {children}
        </>
    );
}
