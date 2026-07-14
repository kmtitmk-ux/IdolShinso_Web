import { NextResponse } from 'next/server';
import { downloadData } from 'aws-amplify/storage';
import { Amplify } from 'aws-amplify';
import outputs from '@/amplify_outputs.json';
Amplify.configure(outputs, { ssr: true });

export const revalidate = 3600; // 1時間サーバーキャッシュ

export async function GET() {
    try {
        const { body } = await downloadData({ path: "public/sitemap.xml" }).result;
        const xmlText = await body.text();
        return new NextResponse(xmlText, {
            status: 200,
            headers: {
                'Content-Type': 'application/xml',
                'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
            },
        });
    } catch (error) {
        console.error('Error fetching sitemap with downloadData:', error);
        const errorMessage = String(error);
        if (errorMessage.includes('Not Found') || errorMessage.includes('NoSuchKey')) {
            return new NextResponse('Sitemap not found in private S3.', { status: 404 });
        }
        return new NextResponse('Internal Server Error.', { status: 500 });
    }
}