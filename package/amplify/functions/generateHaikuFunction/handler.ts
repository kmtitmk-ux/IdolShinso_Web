import {
    BedrockRuntimeClient,
    InvokeModelCommand,
    InvokeModelCommandInput,
} from "@aws-sdk/client-bedrock-runtime";

import type { Handler } from 'aws-lambda';

// initialize bedrock runtime client
const client = new BedrockRuntimeClient();

export const handler: Handler = async (event: any) => {
    console.info("event", event);
    const prompt = `
次の日本語の記事タイトルをリライトしてください。
条件：
- 読者の興味を引くキャッチーな表現にする
- 文字数は30文字以内
- 元の意味はできるだけ保つ

元タイトル：「${event.title}」
`;

    // Invoke model
    const input = {
        modelId: process.env.MODEL_ID, // 例: "anthropic.claude-3-haiku-20240307-v1:0"
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
            anthropic_version: "bedrock-2023-05-31",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: prompt, // ← ここに「日本語タイトルをリライトしてください」などの指示
                        },
                    ],
                },
            ],
            max_tokens: 1000,
            temperature: 0.5
        })
    };


    const command = new InvokeModelCommand(input);

    const response = await client.send(command);
    console.log(response);

    // Parse the response and return the generated haiku
    const data = JSON.parse(Buffer.from(response.body).toString());

    return data.content[0].text;
};