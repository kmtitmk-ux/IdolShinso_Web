import { createServerRunner } from '@aws-amplify/adapter-nextjs';
import outputs from '@/amplify_outputs.json';

// // 環境に応じてドメインを設定
// console.log(process.env.NODE_ENV);
// const isLocalhost = process.env.NODE_ENV === 'development';
// const cookieDomain = isLocalhost ? 'localhost' : '.myapp.com';

export const {
    runWithAmplifyServerContext,
    createAuthRouteHandlers
} = createServerRunner({
    config: outputs,
    runtimeOptions: {
        cookies: {
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 7 // 7 days
        }
    }
});