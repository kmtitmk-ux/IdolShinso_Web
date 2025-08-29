import { cookies } from 'next/headers';
import { type Schema } from '@/amplify/data/resource';
import { createServerRunner } from '@aws-amplify/adapter-nextjs';
import { generateServerClientUsingCookies } from '@aws-amplify/adapter-nextjs/data';
import outputs from '@/amplify_outputs.json';

export const cookiesClient = generateServerClientUsingCookies<Schema>({
    config: outputs,
    cookies
});

export const { runWithAmplifyServerContext } = createServerRunner({
    config: outputs
});